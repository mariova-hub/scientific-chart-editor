# Scientific Chart Editor

Scientific Chart Editorは、Chromebook / Chrome上で科学実験・研究用グラフを作成・編集するWebアプリです。Google Sheets等で解析済みの表データを貼り付け、詳細な書式を調整し、再編集可能なProjectまたは画像として保存できます。

## 公開URL

[Scientific Chart Editorを開く](https://mariova-hub.github.io/scientific-chart-editor/)

GitHub Pagesへの反映は`main` branchへのpush後に自動実行されます。初回公開時はrepositoryのSettings → PagesでSourceを「GitHub Actions」に設定してください。

## 主な機能

- Google Sheets等からセルへ矩形Paste
- セルの直接編集、消去、複数回Paste
- 散布図、縦棒グラフ、横棒グラフ
- データ点・棒ごとに異なるError Bar
- 列方向／行方向のデータ解釈
- 軸範囲、主目盛間隔、補助目盛間隔
- 軸、目盛、グリッド、ラベル、プロット領域の書式
- PNG（1× / 2× / 3×、透明背景）およびSVG出力
- `.scientific-chart.json`によるProject保存、読込、対応環境での上書き保存
- IndexedDBによる自動保存とページ再読込時の作業復元

## 対応環境

- Chromebook版Google Chrome
- Windows版Google Chrome

File System Access APIを利用できるChromeでは、開いたProjectファイルへの上書き保存ができます。利用できない環境や権限がない場合は、ダウンロード保存とファイル選択による読込へ切り替わります。

自動保存は利用中のブラウザとURLごとに保存されます。localhostとGitHub Pagesの自動保存は共有されません。端末間で移動するときはProjectファイルを保存してください。

## 生徒向け基本操作

1. Google Sheetsで実験データを解析し、必要なセルをコピーします。
2. Scientific Chart Editorの貼り付け先セルを選び、Ctrl+Vで貼り付けます。
3. グラフの種類を選び、X / Y、またはカテゴリ / 値 / 誤差範囲を指定します。
4. 必要に応じて、データ系列を行方向または列方向として読み取る設定へ切り替えます。
5. 右側の書式設定で軸範囲、目盛、色、ラベル等を調整します。
6. 「保存」または「名前を付けて保存」でProjectを残します。
7. 提出物や発表資料にはPNGまたはSVGを出力します。

Projectファイルは後から読み込んで編集を続けられます。PNG / SVGは成果物用であり、再編集用のProjectファイルとは別です。

## 開発と品質確認

```text
npm ci
npm test
npm run lint
npm run build
npm run preview
```

GitHub PagesはGitHub Actionsがproduction buildを作成し、`dist`だけを公開します。API key、外部サーバー、利用状況解析は使用しません。
