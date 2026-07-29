# ADR 0017｜宮位整合只建立 deterministic 索引與來源圖

本對宮 Axis Result 與三方暗合 Structural Influence 已各自完成命理推演及來源驗證後，宮位整合不再呼叫模型，也不重新寫一份綜合人格。程式依原始 ID 建立合法分面索引及來源圖，並由實際參照重算 coverage；完整文字仍留在原始已驗證結果。

這樣能讓只有結構影響、沒有 Axis claim 的分面被誠實保留，也能讓正向與負向影響同時存在而不互相抵銷。任何摘要、吉凶分數、飛化、文章文字或未知欄位都不能進入整合 Contract。

下游若要取得主張或生活例子，必須沿 `axisResultRef`、`structuralInfluenceResultRef`、claim／influence ID 回到原始結果。整合索引不能取代來源，也不能藉合併相似句子刪除不同機制。
