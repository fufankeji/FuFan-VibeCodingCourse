"""
Checkpointer 配置管理

开发环境：InMemorySaver（进程内存，重启丢失）
生产环境：AsyncPostgresSaver / SqliteSaver（持久化）

本模块提供 checkpointer 工厂函数，供 graph.py 使用。
"""
import os
from langgraph.checkpoint.memory import InMemorySaver

# 全局 checkpointer 单例
_checkpointer = None


def get_checkpointer():
    """
    获取全局 checkpointer 实例（单例）

    开发环境使用 InMemorySaver，满足 MVP 测试需求。
    生产环境替换为 SqliteSaver 或 AsyncPostgresSaver。
    """
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = InMemorySaver()
    return _checkpointer


def reset_checkpointer():
    """重置 checkpointer（测试用）"""
    global _checkpointer
    _checkpointer = InMemorySaver()
    return _checkpointer
