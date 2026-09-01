# Scientific Chart Editor Project Format v0.1

## 1. 文書の位置付け

本書はScientific Chart Editor v0.1の編集用プロジェクトファイル契約を定める。対象拡張子は次とする。

```text
*.scientific-chart.json
```

このファイルは画像出力ではなく、アプリ終了後も編集を再開するためのJSON形式である。MIME typeはv0.1では`application/json`を使用する。専用MIME typeの登録は将来検討とする。

本書の例は説明用であり、実装時には本書に対応する機械検証可能なschemaをPersistence層で定義する。

## 2. 設計原則

- 保存形式はScientific Chart Editor独自の意味モデルを表す。
- Plotlyの`layout`、`trace`、`Data[]`、イベントpayload、描画キャッシュを保存しない。
- 元データと再編集に必要な利用者設定を自己完結して保存する。
- 内部参照は配列indexではなくstable IDを使う。
- 読み込み後に、保存時と意味的に同一の編集状態へ復元できる。
- schema versionを必須とし、versionごとのvalidatorとmigrationをPersistence層が所有する。
- JSONとして安全に扱える宣言的データだけを保存し、式、スクリプト、任意コードを実行しない。

## 3. versionと互換性

### 3.1 `schemaVersion`

トップレベルの`schemaVersion`は必須の文字列であり、v0.1では厳密に`"0.1"`とする。

```json
{
  "schemaVersion": "0.1",
  "app": "scientific-chart-editor",
  "project": {}
}
```

version文字列は`major.minor`形式で管理するが、自動的なSemVer互換を仮定しない。各versionについて読取可否とmigration経路を明示的に登録する。

### 3.2 backward compatibility

- 新しいアプリversionは、サポート対象に含めた過去schemaを読み込み、段階的migrationで現在schemaへ変換する。
- v0.1より古い試作形式には公開互換性を保証しない。必要な場合だけ明示的なimporterを追加する。
- migration後の保存は現在schemaで行う。元ファイルは自動上書きせず、利用者の明示的な保存操作を必要とする。
- 古いアプリが新しいschemaを読めるforward compatibilityは保証しない。

### 3.3 migration責務

Migration Registry、version判定、migration実行、version別validationは`persistence/`が所有する。UIコンポーネント、Chart Model、Renderer Adapterにmigration分岐を置かない。

各migrationは、1つ前の既知DTOから次のDTOを生成する決定的な純粋関数とし、入力を直接変更しない。migration fixtureにより過去ファイルから現在モデルへの変換を検証する。

### 3.4 unknown field handling

- 既知の`schemaVersion`内で未知fieldが存在しても、それだけを理由に読み込みを失敗させない。
- 未知fieldは意味解釈や実行をせず、同じプロジェクトを再保存するときに可能な限り同じ階層で保持・再出力する。
- 拡張機能は衝突を避けるため、各主要objectの任意`extensions` object配下に名前空間付きkeyを置くことを推奨する。
- 既知fieldと同名の未知表現、型不一致、参照不整合はunknownとして救済せずinvalid fileとする。
- `schemaVersion`自体が未対応なら、fieldを推測して編集可能状態として読み込まない。内容を変更せず安全に拒否し、対応versionを表示する。

未知fieldの保持が実装できるまでは、新しいschema versionを既知versionとして宣言してはならない。この方針により、古い実装が新しい情報を無言で破棄することを防ぐ。

## 4. トップレベル構造

次は階層を示す概要であり、`datasets`、`chart`の必須内容を省略した説明用断片である。単独では有効なv0.1ファイルではない。

```json
{
  "schemaVersion": "0.1",
  "app": "scientific-chart-editor",
  "project": {
    "id": "project-01J...",
    "metadata": {
      "title": "Pendulum experiment",
      "createdAt": "2026-09-01T09:00:00.000Z",
      "updatedAt": "2026-09-01T09:30:00.000Z"
    },
    "datasets": [],
    "chart": {},
    "extensions": {}
  }
}
```

### 4.1 必須field

| path | 型 | 説明 |
|---|---|---|
| `schemaVersion` | string | v0.1では`"0.1"` |
| `app` | string | 厳密に`"scientific-chart-editor"` |
| `project` | object | 編集可能なプロジェクト本体 |
| `project.id` | string | stable project ID |
| `project.metadata` | object | 表示名と時刻等のmetadata |
| `project.datasets` | array | 元データ。v0.1では通常1要素 |
| `project.chart` | object | v0.1の単一Chart Model |

時刻はUTCのISO 8601文字列で保存する。時刻やproject titleの差はグラフの意味的同一性には影響しない。

## 5. ID方針

project、dataset、column、row、chart、axis、series、trendline等、参照または個別編集するentityはstable IDを持つ。

- IDはプロジェクト内でentity種別を越えて衝突しない文字列を推奨する。
- UUID / ULID等、クライアント側で生成可能な方式を用いる。具体方式は実装開始前に確定する。
- 配列indexは表示順を表すだけで、参照先の識別に使用しない。
- 項目の並べ替え後もIDは変更しない。
- objectの内容変更を理由にIDを再生成しない。
- entityを複製した場合は新しいIDを生成し、内部参照を複製先へ張り直す。

配列indexだけに依存すると、系列や列の挿入・削除・並べ替えで参照先が変わるため採用しない。stable IDにより、系列と軸、系列とデータ列、選択対象、将来のUndo / Redo、migrationを安全に関連付けられる。

## 6. 元データ形式

### 6.1 Dataset

```json
{
  "id": "dataset-main",
  "name": "Sheet data",
  "columns": [
    { "id": "col-x", "name": "Time (s)" },
    { "id": "col-y", "name": "Distance (m)" },
    { "id": "col-yerr", "name": "Error (m)" }
  ],
  "rows": [
    {
      "id": "row-1",
      "cells": {
        "col-x": 0,
        "col-y": 0.1,
        "col-yerr": 0.02
      }
    },
    {
      "id": "row-2",
      "cells": {
        "col-x": 1,
        "col-y": 1.4,
        "col-yerr": 0.1
      }
    }
  ]
}
```

- `columns`と`rows`の配列順が表の表示順である。
- `cells`はcolumn IDをkeyとするobjectである。
- v0.1では各row IDはdataset内、各column IDはdataset内で一意でなければならない。
- `cells`に未知column IDがあるファイルは参照不整合として無効とする。
- 行ごとに値数が違う貼り付けも、存在しないセルを空セルとして補正し、長方形の列定義を保つ。

### 6.2 Cell Value

v0.1のセル値はJSONの次の3種類だけを使用する。

| JSON値 | 意味 |
|---|---|
| number | 有限な数値 |
| string | 文字列。`""`は明示的な空文字列 |
| null | 空セル |

`NaN`、`Infinity`、`-Infinity`はJSON numberではなく、保存を拒否する。boolean、array、objectはv0.1のセル値として許可しない。日付、数式、真偽値等がクリップボードから入る場合は、v0.1では表示文字列として保持し、計算または実行しない。

セル自体が欠落している場合も読み込み時に`null`相当として扱えるが、正規化して再保存するときは空セルを明示的な`null`として出力することを推奨する。`null`と`""`は区別してround-tripする。

数値への自動変換規則はlocale依存を避ける必要がある。小数点、指数表記、桁区切り等のparse規則は実装開始前に確定し、保存時にはparse後の有限numberまたは元のstringのいずれかを明確に保持する。

## 7. Data Range / Data Binding

X、Y、誤差値等の1次元範囲は次の形で参照する。

```json
{
  "datasetId": "dataset-main",
  "columnId": "col-x",
  "rows": {
    "kind": "range",
    "startRowId": "row-1",
    "endRowId": "row-12"
  }
}
```

`startRowId`と`endRowId`は両端を含む。datasetの`rows`順で開始が終了以前でなければならない。列全体を参照する場合は次を使う。

```json
{
  "datasetId": "dataset-main",
  "columnId": "col-y",
  "rows": { "kind": "all" }
}
```

参照先のdataset、column、rowは全て存在しなければならない。X/Yおよび対応する誤差値は、欠損処理後に必要な要素数が一致しなければならない。範囲は値のコピーではなく参照であり、元セルの確定変更がグラフへ反映される。

## 8. Chart形式

### 8.1 全体例

```json
{
  "id": "chart-main",
  "type": "scatter",
  "title": {
    "visible": true,
    "text": "Distance over time"
  },
  "legend": {
    "visible": true,
    "position": "right"
  },
  "size": {
    "widthPx": 800,
    "heightPx": 500
  },
  "axes": [],
  "series": [],
  "annotations": [],
  "extensions": {}
}
```

Phase 3A writerが使用する`type`のenumは`scatter`または`bar`である。棒グラフは方向別の種類を重複させず、`chart.bar.orientation`を`vertical`または`horizontal`として保存する。初期設計案の`column`はwriter値として採用しない。折れ線は後続Phaseで別variantとして追加する。いずれもPlotlyのtrace typeや`v` / `h`とは独立したScientific Chart Editorの値である。

`widthPx`と`heightPx`は有限の正の整数とし、UIが許容する最小・最大値の範囲内でなければならない。上限は実装開始前に確定する。

`annotations`は将来拡張用としてv0.1では空配列を保存する。v0.1のUIは注釈を作成・編集しない。

### 8.2 Axis

```json
{
  "id": "axis-x-primary",
  "dimension": "x",
  "position": "bottom",
  "title": {
    "visible": true,
    "text": "Time (s)"
  },
  "scale": {
    "type": "linear",
    "minimum": null,
    "maximum": null,
    "reversed": false
  },
  "ticks": {
    "majorInterval": {
      "mode": "auto"
    },
    "minorInterval": {
      "mode": "none"
    },
    "direction": "outside"
  },
  "gridLines": {
    "majorVisible": true,
    "minorVisible": false
  },
  "numberFormat": {
    "kind": "auto"
  }
}
```

- `dimension`: `x`または`y`
- `position`: v0.1ではX軸が`bottom`、Y軸が`left`
- `scale.type`: `linear`または`log`
- `minimum` / `maximum`: 自動なら`null`、手動なら有限number
- `majorInterval`: `{ "mode": "auto" }`、または`{ "mode": "fixed", "step": 1 }`。`step`は正の有限number
- `minorInterval`: `{ "mode": "none" }`、`{ "mode": "auto" }`、または`{ "mode": "fixed", "step": 0.2 }`。`step`は正の有限number
- `ticks.direction`: `inside`、`outside`、`cross`、`none`
- `numberFormat.kind`: v0.1では`auto`

`axes`は配列とし、v0.1ではX/Y各1つを必須とする。将来、第2軸を別IDとpositionで追加し、系列のaxis参照を付け替えられる。

### 8.3 Series

```json
{
  "id": "series-distance",
  "name": "Distance",
  "visible": true,
  "bindings": {
    "x": {
      "datasetId": "dataset-main",
      "columnId": "col-x",
      "rows": { "kind": "all" }
    },
    "y": {
      "datasetId": "dataset-main",
      "columnId": "col-y",
      "rows": { "kind": "all" }
    }
  },
  "axisIds": {
    "x": "axis-x-primary",
    "y": "axis-y-primary"
  },
  "style": {
    "color": "#1f77b4",
    "line": {
      "visible": false,
      "widthPx": 2,
      "dash": "solid"
    },
    "marker": {
      "visible": true,
      "shape": "circle",
      "sizePx": 8
    },
    "bar": {
      "fillColor": "#1f77b4",
      "borderColor": "#1f77b4",
      "borderWidthPx": 1
    }
  },
  "errorBars": {
    "x": { "enabled": false, "value": null },
    "y": {
      "enabled": true,
      "value": {
        "kind": "symmetric",
        "source": {
          "datasetId": "dataset-main",
          "columnId": "col-yerr",
          "rows": { "kind": "all" }
        }
      }
    }
  },
  "trendlines": []
}
```

系列順は`series`配列順とするが、axis、選択、編集、将来の注釈等はseries IDを参照する。X/Y入れ替えは`bindings.x`と`bindings.y`を交換する正規操作とし、データ列そのものは変更しない。

色はv0.1では`#RRGGBB`形式を正規形とする。透過色が必要になった場合は次schemaでalphaを明示的に追加する。線種、マーカー種類の完全なenumは実装開始前に確定し、保存schemaで閉じたenumとして管理する。

### 8.4 Error Bar

v0.1は対称誤差だけをサポートする。

```json
{
  "enabled": true,
  "value": {
    "kind": "symmetric",
    "source": {
      "datasetId": "dataset-main",
      "columnId": "col-yerr",
      "rows": { "kind": "all" }
    }
  }
}
```

`enabled: false`では`value`を`null`にできる。`enabled: true`では`value`が必須であり、解決した各値は0以上の有限numberでなければならない。

将来の非対称誤差は、既存の`symmetric`を変更せず次のvariantを追加する。

```json
{
  "kind": "asymmetric",
  "positiveSource": {},
  "negativeSource": {}
}
```

v0.1 readerは`asymmetric`を既知の値として推測せず、対応schema versionへのmigrationまたはversion拒否によって扱う。

### 8.5 Trendline

```json
{
  "id": "trendline-linear-1",
  "type": "linear",
  "parameters": {},
  "display": {
    "showEquation": true,
    "showRSquared": true
  },
  "style": {
    "color": "#d62728",
    "widthPx": 2,
    "dash": "dash"
  }
}
```

`type`のv0.1 enumは次とする。

- `linear`
- `polynomial`
- `exponential`
- `logarithmic`
- `power`

`polynomial`では`parameters.degree`に正の整数を保存する。他方式の`parameters`はv0.1では空objectとする。

`trendlines`は配列とする。v0.1 UIが1系列1本に制限しても、将来は別IDの要素を追加するだけで複数近似曲線を表現できる。

回帰係数、R²、方程式の整形済み文字列、描画用サンプル点は保存しない。これらはDataset、bindings、Trendline設定からRegression Engineが再計算する派生値である。将来、再現性のため計算engine versionが必要になった場合は新schemaで明示する。

## 9. 保存対象と非保存対象

### 9.1 必ず保存する状態

- 元データ（列、行、数値、文字列、空セル）
- データ列と範囲
- 系列、系列順、表示状態、名称
- グラフ種類
- X/Y割当とX/Y入れ替え後の結果
- X/Y軸設定と系列から軸への参照
- X/Yエラーバー設定と誤差値範囲
- 近似曲線設定
- グラフタイトルと軸タイトル
- 凡例
- 色、線、マーカー、棒書式
- グラフ幅・高さ
- 将来追加された、再編集に必要なChart Model状態

### 9.2 保存しない派生・一時状態

- Plotlyのtrace、layout、config
- Plotlyが付与した既定値、UID、curve index
- 回帰係数、R²、描画サンプル点等の再計算可能なcache
- SVG / PNG本体
- hover、選択枠、ドラッグ途中のサイズ
- DOM参照、React component state
- Undo / Redo履歴。ただし将来要件となった場合は別schemaで追加する。
- ローカルファイルの絶対pathやブラウザ固有handle

## 10. 完全復元とround-trip

保存→読み込み後に、次が成立しなければならない。

- 全てのstable ID参照が同じentityを指す。
- セルのnumber / string / null、行列順、列名が保持される。
- X/Y/誤差値のData Rangeが同じセル群を指す。
- グラフ種類、軸、系列、書式、エラーバー、近似曲線、タイトル、凡例、サイズが同じ意味を持つ。
- 派生値を再計算し、同等の描画要求とSVG / PNGを生成できる。
- 読み込み直後から編集・再保存できる。

JSONのobject key順、indent、metadataの`updatedAt`、未知fieldの順序、浮動小数の字句表現は同一である必要はない。構造を正規化した比較、またはserialize→deserialize後のProject State比較をround-trip判定に使う。

## 11. invalid file handling

読み込みは次の順に行う。

1. ファイルの拡張子とサイズを事前確認する。拡張子だけでは信頼しない。
2. UTF-8 JSONとしてparseする。
3. `app`と`schemaVersion`を確認する。
4. 対応するversion schemaで型と必須fieldを検証する。
5. 必要なmigrationを適用する。
6. IDの一意性と全参照の存在を検証する。
7. 範囲順、値数、有限数、軸範囲、誤差値、回帰定義域等を意味検証する。
8. 全て成功した場合だけ現在のProject Stateを置換する。

失敗時は次を満たす。

- 現在編集中のプロジェクトを変更しない。
- 自動修復や一部読み込みを無言で行わない。
- 利用者に、未対応version、JSON破損、必須項目欠落、参照不整合等の分類と可能ならfield pathを示す。
- ファイル内の文字列をHTMLまたはコードとして実行しない。
- 極端に大きいファイル、深い入れ子、過大な文字列に対する上限を設ける。具体値は実装開始前に確定する。

安全に修復可能な過去schemaの差だけを、登録済みmigrationで変換する。現在schemaの不正値をmigrationで推測修復しない。

## 12. 将来拡張方針

### 12.1 非対称エラーバー

Error Barの`value.kind`に`asymmetric`を追加し、`positiveSource`と`negativeSource`を持たせる。既存`symmetric.source`の意味は変更しない。

### 12.2 第2軸

`chart.axes`へ別IDの軸を追加し、`series.axisIds.x`または`y`を新しいIDへ向ける。既存primary axisのIDと意味は維持する。

### 12.3 複数近似曲線

既存の`series.trendlines`配列へstable IDを持つ要素を追加する。v0.1ファイルの空配列または単一要素はそのまま有効である。

### 12.4 注釈・テキストボックス

`chart.annotations`配列へ、`kind`で判別する注釈variantを追加する。データ座標、paper座標、series/point参照等は追加時のschemaで明示する。v0.1では空配列とし、Plotly annotation JSONを直接格納しない。

### 12.5 新しい保存version

- 既存fieldの意味を可能な限り変更せず、新しい任意fieldまたはvariantを追加する。
- 既存fieldの意味変更や構造変更が必要なら`schemaVersion`を上げ、migrationを提供する。
- versionごとのDTOとfixtureを保持し、読み込み時に現在形へ変換する。
- 新versionの保存開始前に、旧version読込、migration、再保存の受け入れ確認を行う。

## 13. 最初の実装縦切りで必要な最小保存内容

最初の縦切りでは、少なくとも次を実ファイルでround-tripさせる。

```text
貼り付けたDataset
  ├─ X列
  ├─ Y列
  └─ Y誤差列
        ↓
単一散布図Series
  ├─ X/Y Data Binding
  └─ symmetric Y Error Bar Binding
        ↓
primary X/Y Axis
  ├─ minimum
  ├─ maximum
  └─ majorInterval
        ↓
Chart size
  ├─ widthPx
  └─ heightPx
```

実際にプロジェクトファイルを保存し、アプリを終了・再起動してから読み込み、同一のstable ID参照と意味状態を復元した後にSVGを出力する。メモリ内store、開発時fixture、Plotly JSONに依存した復元は完了とみなさない。

この縦切りが成立するまで、棒グラフ、複数系列、Xエラーバー、PNG、詳細書式、高度な回帰の保存形式へ横展開しない。ただし、v0.1 schemaの全体形、version、stable ID、Plotly非依存という契約は最初から守る。

## 14. 実装開始前の未確定事項

- ID生成方式（UUID / ULID等）と文字数上限
- JSON schema等のruntime validator選定
- unknown fieldを階層ごとに保持して再出力する具体方式
- 列見出し判定と数値parseのlocale規則
- 欠損値を含むX/Y/誤差範囲の点対応規則
- project、dataset、row、column、seriesの最大数と最大ファイルサイズ
- width / height、線幅、マーカーサイズ等の許容範囲
- line dash、marker shape、legend positionの確定enum
- project metadataにアプリversion、作成者メモ等を含めるか
- 回帰再現性のため計算engine versionや数値方式を保存する必要性

## 15. Phase 1実装プロファイル

Phase 1 writerは本schemaのうち、単一dataset、単一`scatter` chart、X/Y各1軸、単一series、対称Y Errorを出力する。`trendlines`と`annotations`は空配列とする。他のv0.1機能は後続Phaseで追加する。

- productionのentity IDはブラウザの`crypto.randomUUID()`で生成する。
- TSVの数値は、前後空白除去後に符号付き10進数または指数表記としてセル全体が一致し、かつ`Number.isFinite`を満たす場合だけJSON numberにする。
- 空または空白だけのセルは`null`、それ以外の非数値セルは元のstringとして保存する。
- Phase 1の最大値は256列、10,000行、プロジェクトファイル5 MiBとする。
- グラフ寸法は幅360〜1,600px、高さ300〜1,200pxの整数とする。
- 無効なY Errorセルも元データとしてそのまま保存する。描画対象となるX/Y行に`null`、非`number`、非有限値、負値のY Errorが1件でもあれば、読み込み後も派生描画処理で系列全体のエラーバーを無効化し、UIで該当件数を示す。数値の0は有効な誤差値であり、欠損・不正値の代替には使用しない。
- エラーバーの派生表示可否や代替値は保存しない。Projectにはユーザーが指定したY Error bindingと`enabled`、元のセル値を保存し、読み込み後に同じ検証規則から表示可否を再計算する。
- 既知の0.1構造を検証した後は元objectをProject State候補として保持するため、未知fieldは読み込み・再保存の過程で維持される。既知fieldの型不正は拒否する。
- Phase 1にはmigration対象となる旧公開schemaがないため、`schemaVersion`が`0.1`以外のファイルは安全に拒否する。

## 16. Phase 2書式fieldと0.1互換性

Phase 2 writerも`schemaVersion: "0.1"`を使用する。Phase 0-Bで定義済みだった書式概念を具体化した追加fieldであり、Phase 1 writerが出力した同versionファイルでは次のfieldが欠落し得る。readerは**欠落時だけ**次の安全なdefaultを補い、現在のProject Stateへ正規化する。

| path（各entity内） | Phase 2形式／default |
|---|---|
| `chart.style` | `{ "backgroundColor": "#ffffff", "plotBackgroundColor": "#ffffff" }` |
| `chart.title.style` | Arial、20px、`#172033`、非bold |
| `axis.ticks.majorVisible/minorVisible` | `true` / `false` |
| `axis.line` | visible、`#4b5563`、1px |
| `axis.labels` | Arial、12px、`#374151` |
| `series.style.line.color` | 旧`series.style.color` |
| `series.style.marker.fillColor/borderColor/borderWidthPx` | 旧`series.style.color` / 同色 / 1px |
| `errorBars.x.style` / `errorBars.y.style` | visible、旧系列色、1.5px、cap 4px |

明示的に存在するfieldが不正enum、不正型、範囲外数値、不正色である場合はhydrationで補正せずinvalid fileとして拒否する。正規色は大文字・小文字を問わない`#RRGGBB`形式であり、writerはブラウザ色入力から得た同形式の文字列を保存する。

### 16.1 Phase 2 enum

- `axis.scale.type`: `linear` / `log`
- `axis.ticks.direction`: `inside` / `outside` / `cross` / `none`
- `series.style.marker.shape`: `circle` / `square` / `diamond` / `triangle-up` / `cross` / `x`
- `series.style.line.dash`: `solid` / `dash` / `dot` / `dash-dot`
- `chart.legend.position`: `right` / `left` / `top` / `bottom`

Plotly固有の`dashdot`や凡例座標は保存しない。

### 16.2 保存対象と非保存対象

軸線・目盛・grid・label、marker・line、Y error style、chart background、plot background、title style、legend position、および確定したchart sizeは保存対象である。Selection、数値入力draft、警告、ドラッグ中preview、Y Errorの派生表示可否は保存しない。読み込み後は保存した意味設定と元データから派生状態を再計算する。

## 17. Phase 3A棒グラフfieldと0.1互換性

Phase 3Aでも`schemaVersion: "0.1"`を使用し、Phase 1 / 2 readerが定義済み概念を具体化した次の意味fieldを保存する。

```json
{
  "chart": {
    "type": "bar",
    "bar": { "orientation": "vertical", "gapRatio": 0.2 },
    "series": [{
      "barBindings": {
        "category": { "datasetId": "dataset-main", "columnId": "col-category", "rows": { "kind": "all" } },
        "value": { "datasetId": "dataset-main", "columnId": "col-value", "rows": { "kind": "all" } },
        "error": { "datasetId": "dataset-main", "columnId": "col-error", "rows": { "kind": "all" } }
      },
      "style": {
        "bar": {
          "fillColor": "#2563eb",
          "borderColor": "#1d4ed8",
          "borderWidthPx": 1,
          "opacity": 1,
          "widthRatio": 0.8
        }
      }
    }]
  }
}
```

- `orientation`: `vertical` / `horizontal`。Category / Value / Errorの意味は方向によらず不変とする。
- `gapRatio`: 0〜0.9、`widthRatio`: 0.05〜1、`opacity`: 0〜1の有限numberとする。Plotlyの`bargap`やtrace width名は保存しない。
- `barBindings.error`は未指定なら`null`。指定時も不正セルを置換せずDatasetへ保持する。全体表示可否、不正件数、縦棒のY Error／横棒のX Errorという描画方向は派生状態であり保存しない。
- `bindings.x/y`は散布図、`barBindings`は棒グラフの意味契約である。非アクティブ側は将来の種類切替に備えて保持でき、`null`も許容する。active type側の必須bindingだけをsemantic validationする。
- カテゴリ軸／値軸の区別はtypeとorientationから派生し、Axis ModelへPlotlyのcategory typeを保存しない。
- Data Pane幅、列強調badge、除外／警告件数、SelectionはSession／派生状態のため保存しない。

旧`0.1` scatterファイルで`chart.bar`、`series.barBindings`、`style.bar.opacity`、`style.bar.widthRatio`が欠落する場合、readerは欠落時だけそれぞれvertical / 0.2、既存X / Y / Y Error参照、1、0.8を補う。明示された不正enum・範囲外値・参照不整合はdefaultで救済せずinvalid fileとして拒否する。

## 18. Phase 3B-1 editable gridの保存契約

Phase 3B-1はschema構造を変更せず`schemaVersion: "0.1"`を維持する。矩形Pasteの結果は既存の`DatasetModel`へ次のように正規化して保存する。

- Grid row 1（内部`rowIndex: 0`）は`columns[].name`として保存する。
- Grid row 2以降は`rows[].cells[columnId]`の`number | string | null`として保存する。
- 部分上書き後も既存dataset / column / row IDを維持し、拡張された行・列だけ新規IDを持つ。
- 新規列によって既存行に増えた空セル、および新規行の未貼り付け列は`null`として保存する。
- 貼り付け操作履歴、clipboard原文、active cell、focus、選択枠は保存しない。
- X/Y/Y ErrorおよびCategory/Value/Error bindingはcolumn ID参照のまま保存し、セル値更新によって付け替えない。

通常PasteとDataset全置換は保存形式上ではどちらも最終Dataset snapshotとなるが、編集時の操作契約は区別する。通常Pasteは既存stable IDを維持する`paste-range`操作であり、全置換/importは利用者が明示した別機能としてのみ将来提供できる。

## 19. Phase 3B-2 数値軸範囲の保存契約

Phase 3B-2はAxis ModelとschemaVersionを変更しない。X/Y軸はそれぞれ独立して次の意味値を保存する。

- `scale.minimum` / `scale.maximum`: Autoは`null`、固定は有限number。両方固定なら`minimum < maximum`。
- `ticks.majorInterval`: Autoは`{ "mode": "auto" }`、固定は`{ "mode": "fixed", "step": positiveFiniteNumber }`。
- `ticks.minorInterval`: なし／Auto／固定を既存unionで保存する。Format Paneの「自動に戻す」は`{ "mode": "auto" }`へ確定する。
- 対数軸の固定minimum / maximumは0より大きいnumberとする。

棒グラフでどちらがカテゴリ軸かは`chart.type`と`chart.bar.orientation`から派生し、Plotlyのaxis typeやrangeを保存しない。カテゴリ軸として表示中もAxis Modelの独立設定は破壊せず保持できるが、UIとRendererは適用しない。scatterやorientation変更で同じdimensionが数値軸へ戻った場合に、その意味設定を再利用できる。

旧Phase 1〜3B-1の`0.1`ファイルは同じaxis fieldを既に持つため追加migrationを必要としない。欠落したPhase 2書式fieldだけを従来どおりdefault hydrationし、明示された不正range・unit・log境界は補正せずatomic load前に拒否する。

## 20. Phase 3B-3 セル直接編集の保存契約

Phase 3B-3はschema構造を変更せず`schemaVersion: "0.1"`を維持する。直接編集とセル消去の確定結果は、矩形Pasteと同じ既存Dataset fieldへ保存する。

- 見出しの編集結果は`datasets[].columns[].name`へstringとして保存する。消去した見出しは空stringであり、UI用fallback labelは保存しない。
- データセルの編集結果は`datasets[].rows[].cells[columnId]`へnumber / string / nullとして保存する。消去はnullであり、key自体や行を削除して表現しない。
- 編集・消去では既存dataset / column / row IDを維持するため、X/Y/Y ErrorおよびCategory/Value/Error bindingの参照も変更しない。
- number / string / nullの判定はPasteと共通の`parseCell`契約に従う。入力方法の違い、入力時のdraft、IME変換文字列の中間状態は保存形式へ影響しない。
- Active Cell、Editing Cell、draft text、composition状態、focus、入力エラー、確定後の移動先、edit / clear操作履歴は保存しない。
- 無効なX/Y/Value/Errorセルによる点除外、誤差範囲の全体非表示、警告件数は保存せず、読み込み後に元セル値とbindingから再計算する。

したがってPhase 1〜3B-2ファイルには新fieldやmigrationを要求せず、従来どおり読み込める。直接編集後に保存したファイルも、既存のDataset validation、stable reference validation、atomic load契約だけで復元できる。
