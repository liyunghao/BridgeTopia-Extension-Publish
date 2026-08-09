# Privacy Policy — BridgeTopia Extension

Last updated: 2026-08-09

## What this extension handles

**Your BBO username.** Stored in the browser (`chrome.storage.sync`) so you only type it
once. It is used to ask Bridge Base Online for *your own* list of played hands.

**The deals you select.** When you tick a session and press download, the extension fetches
the `.lin` file of each of those boards from Bridge Base Online and keeps them in your
browser (`chrome.storage.local`). When you press import, and only then, those deals are
uploaded to the BridgeTopia server at `https://bridgetopia.long-becrux.ts.net`, which is
operated by the developer of this extension. A `.lin` file is BBO's own record of a deal:
the cards, the bidding, the play, the table's four BBO handles, and any chat typed at the
table.

Nothing is uploaded until you press import. Searching and downloading talk only to
bridgebase.com.

## What this extension does NOT do

- It does not read your cookies. It does not request Chrome's `cookies` permission, and it
  never sees, stores, or transmits your BBO password or session.
- It does not read, collect, or transmit your browsing history, and it runs on no site
  other than `www.bridgebase.com`.
- It contains no analytics, no advertising, no trackers, and no remote code.
- Your data is not sold, and it is not transferred to any third party. The only destination
  it can reach is the one BridgeTopia server address hard-coded in the extension.
- It is not used for creditworthiness or lending purposes, and not for any purpose other
  than importing your hands into your own BridgeTopia account.

## Where the data lives, and how to remove it

**In your browser.** Downloaded-but-not-yet-imported deals stay in local extension storage
until the import succeeds. The 🗑 button in the popup deletes them, and removing the
extension removes them with it.

**On the BridgeTopia server.** Imported deals are stored under your BridgeTopia account, so
that you can review them. To have them deleted, contact us at the address below.

## Contact

Open an issue at
<https://github.com/liyunghao/BridgeTopia-Extension-Publish/issues>.

## Source

This extension has no build step and is not minified. The source of the published build is
this repository, under GPL-3.0-only.

---

# 隱私權政策 — BridgeTopia 擴充

最後更新：2026-08-09

## 這個擴充會處理什麼

**你的 BBO 帳號名稱。** 存在瀏覽器裡（`chrome.storage.sync`），讓你只需要填一次，用途是跟
Bridge Base Online 要**你自己**打過哪些牌的清單。

**你勾選的牌局。** 按下下載時，擴充會去 Bridge Base Online 抓那幾副牌的 `.lin` 檔，先存在
你的瀏覽器裡（`chrome.storage.local`）。**按下匯入時，也只有那個時候**，這些牌局會上傳到
`https://bridgetopia.long-becrux.ts.net` 這台由本擴充作者營運的 BridgeTopia 伺服器。`.lin`
是 BBO 自己的牌局紀錄格式，內容包含牌張、叫牌、打牌過程、那一桌四個人的 BBO 帳號，以及
牌桌上打過的聊天訊息。

按匯入之前不會有任何東西上傳。查詢和下載只跟 bridgebase.com 連線。

## 這個擴充不做的事

- 不讀你的 cookie。manifest 沒有要求 `cookies` 權限，也不會看到、儲存或傳送你的 BBO 密碼
  或登入 session。
- 不讀取、不蒐集、不傳送你的瀏覽紀錄，而且除了 `www.bridgebase.com` 之外不在任何網站上執行。
- 沒有分析工具、沒有廣告、沒有追蹤器、沒有遠端程式碼。
- 不販售你的資料，也不轉交給任何第三方。它唯一連得到的目的地，就是寫死在擴充裡的那一個
  BridgeTopia 伺服器位址。
- 不用於信用評分或放貸用途，也不用於「把你的牌匯入你自己的 BridgeTopia 帳號」以外的目的。

## 資料放在哪、怎麼刪掉

**在你的瀏覽器裡。** 下載了但還沒匯入的牌局會留在擴充的本機儲存空間，直到匯入成功為止。
popup 上的 🗑 會刪掉它們，移除擴充也會一併移除。

**在 BridgeTopia 伺服器上。** 匯入的牌局存在你的 BridgeTopia 帳號底下，供你事後檢閱。要刪
除的話，用下面的方式聯絡。

## 聯絡方式

到 <https://github.com/liyunghao/BridgeTopia-Extension-Publish/issues> 開一個 issue。

## 原始碼

這個擴充沒有 build step、沒有壓縮混淆，上架版本的原始碼就是這個 repository，授權為
GPL-3.0-only。
