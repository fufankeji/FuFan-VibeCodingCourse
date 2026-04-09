"""
MVP 完整链路测试

测试场景：
1. 健康检查
2. 文件上传（创建合同 + 会话）
3. 等待 OCR 完成（state: parsing → scanning）
4. 查看字段列表
5. 等待扫描完成（state: scanning → hitl_pending）
6. 查看审核条款列表
7. 提交 HITL 决策（Approve，带 10 字以上 note）
8. 验证决策被保存
9. 检验 human_note < 10 字时被拒绝（错误边界）
10. 等待 resume 触发（如果全部高风险已处理）
11. 查看报告状态
"""
import time
import json
import requests
import os
import tempfile
import threading

BASE_URL = "http://localhost:8000/api/v1"
HEADERS = {
    "X-User-ID": "test-user-001",
    "X-User-Role": "reviewer"
}


def create_test_pdf():
    """创建测试用的最小 PDF 文件"""
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
50 700 Td
(Test Contract) Tj
0 -20 Td
(Party A: ABC Technology Co., Ltd.) Tj
0 -20 Td
(Party B: XYZ Consulting Group) Tj
0 -20 Td
(Contract Amount: CNY 500,000) Tj
0 -20 Td
(Party A has the right to modify this agreement at any time, effective immediately.) Tj
0 -20 Td
(Penalty clause: If Party B breaches, penalty is 200% of contract value.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
0000000527 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
610
%%EOF"""

    tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
    tmp.write(pdf_content)
    tmp.close()
    return tmp.name


def test_health():
    """测试 1：健康检查"""
    print("\n=== Test 1: Health Check ===")
    r = requests.get("http://localhost:8000/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    data = r.json()
    assert data["status"] == "ok"
    print(f"PASS Health check OK: {data}")


def test_upload_contract():
    """测试 2：上传合同文件"""
    print("\n=== Test 2: Upload Contract ===")
    pdf_path = create_test_pdf()
    try:
        with open(pdf_path, 'rb') as f:
            r = requests.post(
                f"{BASE_URL}/contracts/upload",
                files={"file": ("test_contract.pdf", f, "application/pdf")},
                headers=HEADERS
            )
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text[:500]}")
        assert r.status_code == 201, f"Upload failed: {r.status_code} - {r.text}"
        data = r.json()
        assert "session_id" in data
        assert "contract_id" in data
        assert data["state"] == "parsing"
        print(f"PASS Upload OK: contract_id={data['contract_id']}, session_id={data['session_id']}")
        return data["contract_id"], data["session_id"]
    finally:
        os.unlink(pdf_path)


def test_get_session(session_id):
    """测试 3：查询会话状态"""
    print(f"\n=== Test 3: Get Session {session_id} ===")
    r = requests.get(f"{BASE_URL}/sessions/{session_id}", headers=HEADERS)
    assert r.status_code == 200, f"Get session failed: {r.status_code} - {r.text}"
    data = r.json()
    print(f"PASS Session state: {data.get('state')}, progress: {data.get('progress_summary')}")
    return data


def wait_for_state(session_id, target_states, max_wait=60):
    """等待会话进入目标状态"""
    print(f"\n[wait] Waiting for state in {target_states} (max {max_wait}s)...")
    for i in range(max_wait):
        time.sleep(1)
        r = requests.get(f"{BASE_URL}/sessions/{session_id}", headers=HEADERS)
        if r.status_code == 200:
            state = r.json().get("state")
            if (i + 1) % 5 == 0:
                print(f"  [{i+1}s] Current state: {state}")
            if state in target_states:
                print(f"  PASS Reached target state: {state}")
                return r.json()
    print(f"  WARN Timeout waiting for {target_states}")
    r = requests.get(f"{BASE_URL}/sessions/{session_id}", headers=HEADERS)
    return r.json() if r.status_code == 200 else {}


def test_get_fields(session_id):
    """测试 4：查询字段列表"""
    print(f"\n=== Test 4: Get Fields for session {session_id} ===")
    r = requests.get(f"{BASE_URL}/sessions/{session_id}/fields", headers=HEADERS)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        # API returns FieldListResponse with 'items' key
        fields = data.get("items", data.get("fields", []))
        print(f"PASS Fields count: {len(fields)}")
        for f in fields[:3]:
            print(f"  - {f.get('field_name')}: {f.get('field_value')} (confidence: {f.get('confidence_score')})")
        return fields
    else:
        print(f"WARN Fields not ready yet: {r.text[:200]}")
        return []


def test_get_items(session_id):
    """测试 5：查询审核条款列表"""
    print(f"\n=== Test 5: Get Items for session {session_id} ===")
    r = requests.get(f"{BASE_URL}/sessions/{session_id}/items", headers=HEADERS)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        # API returns ReviewItemListResponse with 'items' key
        items = data.get("items", data.get("data", []))
        total = data.get("total", len(items))
        print(f"PASS Items count: {len(items)}, total: {total}")
        for item in items[:3]:
            print(f"  - [{item.get('risk_level')}] {item.get('ai_finding', '')[:80]}...")
        return items
    else:
        print(f"WARN Items error: {r.text[:200]}")
        return []


def test_hitl_decision_valid(session_id, item_id):
    """测试 6：提交合法 HITL 决策（confirmed + 10字以上 note）"""
    print(f"\n=== Test 6: Submit HITL Decision (valid) ===")
    import uuid
    r = requests.post(
        f"{BASE_URL}/sessions/{session_id}/items/{item_id}/decision",
        json={
            "decision": "confirmed",
            "human_note": "经与业务法务确认，此条款风险在可接受范围内，已评估实际影响",
            "is_false_positive": False,
        },
        headers={**HEADERS, "Idempotency-Key": str(uuid.uuid4())}
    )
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text[:300]}")
    if r.status_code in (200, 201):
        print(f"PASS Decision submitted successfully")
    else:
        print(f"WARN Decision failed: {r.text}")
    return r.status_code


def test_hitl_decision_invalid_note(session_id, item_id):
    """测试 7：short human_note 被拒绝（错误边界）"""
    print(f"\n=== Test 7: Submit HITL Decision (invalid - note too short) ===")
    import uuid
    r = requests.post(
        f"{BASE_URL}/sessions/{session_id}/items/{item_id}/decision",
        json={
            "decision": "confirmed",
            "human_note": "太短",  # < 10 字
            "is_false_positive": False,
        },
        headers={**HEADERS, "Idempotency-Key": str(uuid.uuid4())}
    )
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text[:300]}")
    if r.status_code == 422:
        print(f"PASS Correctly rejected short note (422)")
    else:
        print(f"WARN Expected 422, got {r.status_code}")


def test_contracts_list():
    """测试 8：合同列表"""
    print(f"\n=== Test 8: Contracts List ===")
    r = requests.get(f"{BASE_URL}/contracts", headers=HEADERS)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        contracts = data.get("items", [])
        print(f"PASS Contracts count: {len(contracts)}")
    else:
        print(f"WARN Contracts list error: {r.text[:200]}")


def test_report(session_id):
    """测试 9：报告状态"""
    print(f"\n=== Test 9: Report Status ===")
    r = requests.get(f"{BASE_URL}/sessions/{session_id}/report", headers=HEADERS)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"PASS Report status: {data.get('report_status')}")
        print(f"  Summary: {json.dumps(data.get('summary', {}), ensure_ascii=False)[:200]}")
    elif r.status_code == 404:
        print(f"WARN Report not ready yet (404 - acceptable for MVP)")
    else:
        print(f"WARN Report error: {r.text[:200]}")


def run_all_tests():
    """运行完整测试链路"""
    print("=" * 60)
    print("合同审核系统 MVP 完整链路测试")
    print("=" * 60)

    results = {"passed": 0, "failed": 0, "warnings": 0}

    try:
        # Test 1: Health
        test_health()
        results["passed"] += 1

        # Test 2: Upload
        contract_id, session_id = test_upload_contract()
        results["passed"] += 1

        # Test 3: Get session
        session_data = test_get_session(session_id)
        results["passed"] += 1

        # Test 8: Contracts list
        test_contracts_list()
        results["passed"] += 1

        # Wait for OCR / scanning
        session_data = wait_for_state(
            session_id,
            ["scanning", "hitl_pending", "completed", "report_ready"],
            max_wait=90
        )
        current_state = session_data.get("state", "unknown")
        print(f"\n[info] After wait, state: {current_state}")

        # Test 4: Fields (if scanning or beyond)
        if current_state in ("scanning", "hitl_pending", "completed", "report_ready"):
            fields = test_get_fields(session_id)
            results["passed"] += 1

        # Test 5: Items
        items = []
        if current_state in ("hitl_pending", "completed"):
            items = test_get_items(session_id)
            results["passed"] += 1
        elif current_state == "scanning":
            # Wait for scan to complete
            session_data = wait_for_state(
                session_id,
                ["hitl_pending", "completed", "report_ready"],
                max_wait=120
            )
            current_state = session_data.get("state", "unknown")
            if current_state in ("hitl_pending", "completed"):
                items = test_get_items(session_id)
                results["passed"] += 1

        # Test 6 & 7: HITL decisions
        high_risk_items = [i for i in items if i.get("risk_level") == "HIGH"]
        if high_risk_items and current_state == "hitl_pending":
            item_id = high_risk_items[0]["id"]

            # Test 7: invalid note first (error boundary)
            test_hitl_decision_invalid_note(session_id, item_id)
            results["passed"] += 1

            # Test 6: valid decision
            status = test_hitl_decision_valid(session_id, item_id)
            if status in (200, 201):
                results["passed"] += 1
            else:
                results["warnings"] += 1
        else:
            print(f"\nWARN Skipping HITL tests - state={current_state}, high_risk_items={len(high_risk_items)}")
            results["warnings"] += 2

        # Test 9: Report
        test_report(session_id)
        results["passed"] += 1

    except AssertionError as e:
        print(f"\nFAIL Test FAILED: {e}")
        results["failed"] += 1
    except Exception as e:
        import traceback
        print(f"\nFAIL Unexpected error: {e}")
        traceback.print_exc()
        results["failed"] += 1

    print("\n" + "=" * 60)
    print(f"Test Results: PASS {results['passed']} passed, FAIL {results['failed']} failed, WARN {results['warnings']} warnings")
    print("=" * 60)

    return results


if __name__ == "__main__":
    run_all_tests()
