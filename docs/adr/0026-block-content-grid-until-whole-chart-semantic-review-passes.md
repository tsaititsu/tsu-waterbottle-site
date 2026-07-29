# 0026：全盤關係語意審查通過前阻擋內容格

Whole-Chart Relation Contract 可以證明一項關係引用合法來源、符合命宮或跨宮基數，並且深刻感受主題有 N0 訊號與 Axis 星曜證據。但這些條件不能證明：

```text
兩項表現真的屬於同一個重複模式
兩個宮位真的形成內在拉扯
深刻感受沒有被煞忌訊號過度放大
生活表現仍忠於來源語境
關係沒有越過 D1 人格邊界
```

如果來源綁定通過就直接建立寫作內容格，可能把語意錯誤固定到後續十二宮文章。另一方面，審查層也不能直接重寫關係，否則會產生第二套無法追查的新命理。

因此新增 `d1WholeChartSemanticReviewContracts.ts`。它逐項接收 source-bound relation，只允許：

```text
APPROVED
REPAIR_REQUIRED
```

需修復時只能列 module-owned 固定問題碼，修復範圍固定為原 relation。不能提供自由文字理由、分數、改寫後關係、客戶摘要或新的來源。

程式會重新驗證 Whole-Chart Relation 的完整上游來源鏈，並確認：

```text
每項 relation 恰好審查一次
審查順序與來源結果相同
relation 專屬問題碼沒有錯掛
coverage 由實際 decision 與 issue 重算
```

任一 relation 需要修復時，已核准 relation 保持不變，但整體 `contentGridHandoffStatus=blocked`。全部核准後才變成 `ready`，讓下一層建立內容格；`customerWritingStatus` 仍固定為 `blocked`，因為內容格本身及最終文章忠實度尚未驗證。

這個切片沒有 OpenAI Runtime、修復呼叫、重試、模型政策或報告生成。未來實際語意審查模型只能產生這個封閉 Contract，再由程式做來源與 coverage 驗證。
