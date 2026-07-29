# 0024：全盤關係完成前只建立未合併寫作來源格

宮位 Axis、三方暗合 Structural Influence 與獨立 Flying Influence 都完成驗證後，後續寫作需要一份逐宮、逐分面的完整來源索引。但此時尚未建立全盤關係，程式無法只靠 Ref 或表面相似文字，可靠判斷不同引擎是否真的指向同一項可觀察行為。

如果在這一層直接合併成最終寫作內容格，可能發生：

```text
把不同機制誤認為同義
把矛盾面向抵銷
只保留一個來源
用摘要取代原始主張
在缺少全盤關係時提前產生客戶文章
```

因此新增 `d1PalaceWritingSourceContracts.ts`。它接收固定十二份 Palace Reasoning Result 與 Flying Palace Integration，驗證它們屬於同一 chart、run 與 Palace Result binding，再依十二宮建立不可變來源格。

每個來源格只保存：

```text
目標宮位
合法生活分面
來源種類
唯一來源 Ref
```

Axis claim、Structural influence 與 Flying influence 各自占一格。空分面不建立假資料；不同來源即使可能導向相似行為，目前也不合併。父母宮天機化祿與財帛宮天機化忌等共存作用會保留為不同格，不計算淨分數，也不選唯一主導來源。

這個 Contract 固定聲明：

```text
semanticMerging = NOT_PERFORMED
wholeChartRelations = REQUIRED_BEFORE_WRITING
customerWriting = BLOCKED
openAiCallable = false
```

所以它不是最終客戶內容格，也不是文章或 OpenAI 輸入。下一層全盤關係完成後，才能在保留全部證據的前提下，依相同宮位、Actor、分面及可觀察機制建立真正的寫作內容格。不同特質、不同機制與矛盾面向仍必須分開。
