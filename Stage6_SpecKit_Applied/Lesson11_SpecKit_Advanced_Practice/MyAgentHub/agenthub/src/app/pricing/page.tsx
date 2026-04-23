import React from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Pricing() {
  return (
    <div className="flex flex-col bg-bg-base px-[24px] py-[48px]">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-[48px] text-center">
          <h1 className="mb-[12px] text-[30px] font-bold text-fg-default">透明、可预测的定价</h1>
          <p className="text-[16px] text-fg-secondary">从个人黑客到企业团队，总有一款适合你。</p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-[24px] md:grid-cols-3 lg:gap-[32px]">
          {/* Free */}
          <Card className="flex flex-col border-border-default hover:border-primary-default/50 transition-colors">
            <CardHeader className="gap-[12px]">
              <CardTitle className="text-[20px]">免费版</CardTitle>
              <CardDescription className="text-[14px]">适合个人开发者试用和验证概念。</CardDescription>
              <div className="text-[30px] font-bold text-fg-default">
                $0<span className="text-[14px] font-normal text-fg-secondary"> / 每月</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-[16px]">
              <div className="flex items-center gap-[8px]">
                <Check className="h-[16px] w-[16px] text-status-success" />
                <span className="text-[14px] text-fg-secondary">每月 1000 次 API 调用</span>
              </div>
              <div className="flex items-center gap-[8px]">
                <Check className="h-[16px] w-[16px] text-status-success" />
                <span className="text-[14px] text-fg-secondary">基础模型访问 (GPT-3.5)</span>
              </div>
              <div className="flex items-center gap-[8px]">
                <Check className="h-[16px] w-[16px] text-status-success" />
                <span className="text-[14px] text-fg-secondary">社区支持</span>
              </div>
            </CardContent>
            <CardFooter className="mt-auto pt-[24px]">
              <Button variant="outline" className="w-full">免费开始</Button>
            </CardFooter>
          </Card>

          {/* Pro */}
          <Card className="relative flex flex-col border-primary-default bg-bg-subtle shadow-lg">
            <div className="absolute -top-[12px] left-1/2 -translate-x-1/2">
              <Badge variant="default" className="px-[12px] py-[4px] text-[12px]">最受欢迎</Badge>
            </div>
            <CardHeader className="gap-[12px]">
              <CardTitle className="text-[20px]">专业版</CardTitle>
              <CardDescription className="text-[14px]">为独立创作者和高级开发者打造。</CardDescription>
              <div className="text-[30px] font-bold text-fg-default">
                $20<span className="text-[14px] font-normal text-fg-secondary"> / 每月</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-[16px]">
              <div className="flex items-center gap-[8px]">
                <Check className="h-[16px] w-[16px] text-status-success" />
                <span className="text-[14px] text-fg-secondary">每月 50,000 次 API 调用</span>
              </div>
              <div className="flex items-center gap-[8px]">
                <Check className="h-[16px] w-[16px] text-status-success" />
                <span className="text-[14px] text-fg-secondary">所有高级模型 (GPT-5.4 / Claude 4.7 / Gemini 2.5)</span>
              </div>
              <div className="flex items-center gap-[8px]">
                <Check className="h-[16px] w-[16px] text-status-success" />
                <span className="text-[14px] text-fg-secondary">高级 Trace 可视化</span>
              </div>
            </CardContent>
            <CardFooter className="mt-auto pt-[24px]">
              <Button className="w-full">升级到专业版</Button>
            </CardFooter>
          </Card>

          {/* Team */}
          <Card className="flex flex-col border-border-default hover:border-primary-default/50 transition-colors">
            <CardHeader className="gap-[12px]">
              <CardTitle className="text-[20px]">团队版</CardTitle>
              <CardDescription className="text-[14px]">适用于需要协作和高可用性的团队。</CardDescription>
              <div className="text-[30px] font-bold text-fg-default">
                $50<span className="text-[14px] font-normal text-fg-secondary"> / 每席 / 每月</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-[16px]">
              <div className="flex items-center gap-[8px]">
                <Check className="h-[16px] w-[16px] text-status-success" />
                <span className="text-[14px] text-fg-secondary">不限次数 API 调用 (合理使用)</span>
              </div>
              <div className="flex items-center gap-[8px]">
                <Check className="h-[16px] w-[16px] text-status-success" />
                <span className="text-[14px] text-fg-secondary">团队编排协作与权限管理</span>
              </div>
              <div className="flex items-center gap-[8px]">
                <Check className="h-[16px] w-[16px] text-status-success" />
                <span className="text-[14px] text-fg-secondary">专属客户成功经理与 SLA 保障</span>
              </div>
            </CardContent>
            <CardFooter className="mt-auto pt-[24px]">
              <Button variant="secondary" className="w-full">联系销售</Button>
            </CardFooter>
          </Card>
        </div>

        {/* Feature Comparison */}
        <div className="mt-[48px]">
          <h2 className="mb-[24px] text-center text-[20px] font-semibold text-fg-default">详细功能对比</h2>
          <div className="overflow-hidden rounded-[8px] border border-border-default bg-bg-subtle">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-bg-elevated border-b border-border-default">
                <tr>
                  <th className="p-[16px] font-medium text-fg-secondary">核心特性</th>
                  <th className="p-[16px] font-medium text-fg-secondary">免费版</th>
                  <th className="p-[16px] font-medium text-fg-secondary">专业版</th>
                  <th className="p-[16px] font-medium text-fg-secondary">团队版</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                <tr>
                  <td className="p-[16px] text-fg-default">大模型 API 访问</td>
                  <td className="p-[16px] text-fg-secondary">仅基础模型</td>
                  <td className="p-[16px] text-fg-secondary">所有可用模型</td>
                  <td className="p-[16px] text-fg-secondary">所有可用模型 + 专属定制</td>
                </tr>
                <tr>
                  <td className="p-[16px] text-fg-default">Trace 留存时间</td>
                  <td className="p-[16px] text-fg-secondary">7 天</td>
                  <td className="p-[16px] text-fg-secondary">30 天</td>
                  <td className="p-[16px] text-fg-secondary">无限期</td>
                </tr>
                <tr>
                  <td className="p-[16px] text-fg-default">流式生成 UI</td>
                  <td className="p-[16px] text-fg-secondary"><Check className="h-[16px] w-[16px] text-status-success" /></td>
                  <td className="p-[16px] text-fg-secondary"><Check className="h-[16px] w-[16px] text-status-success" /></td>
                  <td className="p-[16px] text-fg-secondary"><Check className="h-[16px] w-[16px] text-status-success" /></td>
                </tr>
                <tr>
                  <td className="p-[16px] text-fg-default">并发限制</td>
                  <td className="p-[16px] text-fg-secondary">5 QPS</td>
                  <td className="p-[16px] text-fg-secondary">50 QPS</td>
                  <td className="p-[16px] text-fg-secondary">1000+ QPS</td>
                </tr>
                <tr>
                  <td className="p-[16px] text-fg-default">私有化部署</td>
                  <td className="p-[16px] text-fg-secondary"><X className="h-[16px] w-[16px] text-fg-disabled" /></td>
                  <td className="p-[16px] text-fg-secondary"><X className="h-[16px] w-[16px] text-fg-disabled" /></td>
                  <td className="p-[16px] text-fg-secondary"><Check className="h-[16px] w-[16px] text-status-success" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-[48px] max-w-[800px]">
          <h2 className="mb-[24px] text-center text-[20px] font-semibold text-fg-default">常见问题</h2>
          <div className="flex flex-col gap-[24px]">
            <div className="border-b border-border-default pb-[24px]">
              <h3 className="mb-[8px] text-[16px] font-medium text-fg-default">我可以随时取消订阅吗？</h3>
              <p className="text-[14px] text-fg-secondary">是的，你可以随时在账户设置中取消订阅。取消后，你的权益将保留至当前计费周期结束。</p>
            </div>
            <div className="border-b border-border-default pb-[24px]">
              <h3 className="mb-[8px] text-[16px] font-medium text-fg-default">免费版有什么限制？</h3>
              <p className="text-[14px] text-fg-secondary">免费版仅限于非商业用途的试用，并发限制较严，且只能访问基础的 GPT-3.5 级别模型。</p>
            </div>
            <div className="border-b border-border-default pb-[24px]">
              <h3 className="mb-[8px] text-[16px] font-medium text-fg-default">团队版包含多少个席位？</h3>
              <p className="text-[14px] text-fg-secondary">团队版基础价格包含 1 个席位，你可以按每席 $50/月的价格增加额外的开发者席位。</p>
            </div>
            <div className="border-b border-border-default pb-[24px]">
              <h3 className="mb-[8px] text-[16px] font-medium text-fg-default">你们如何处理我的数据隐私？</h3>
              <p className="text-[14px] text-fg-secondary">我们不会使用你的输入数据来训练基础模型。企业版客户还可以选择数据不出境的私有化部署方案。</p>
            </div>
            <div>
              <h3 className="mb-[8px] text-[16px] font-medium text-fg-default">是否支持按量付费？</h3>
              <p className="text-[14px] text-fg-secondary">目前的套餐包含了固定的额度。对于超额部分，我们提供灵活的 Token 按量计费，具体可在控制台查看账单明细。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}