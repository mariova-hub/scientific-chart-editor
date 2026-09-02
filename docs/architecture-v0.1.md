# Scientific Chart Editor v0.1 アーキテクチャ設計

## 1. 文書の位置付け

本書は Scientific Chart Editor v0.1 の論理構造、責務境界、依存方向、および最初の実装縦切りの構成を定める。機能範囲は `requirements-v0.1.md`、永続化するJSON契約は `project-format-v0.1.md` を正とする。

Phase 0-Bでは設計のみを確定し、Reactコンポーネント、Chart Model、Renderer Adapter、回帰、保存処理を実装しない。

## 2. アーキテクチャ目標

- Scientific Chart Editor固有の意味モデルをアプリの正規状態とする。
- Plotly.jsを交換可能な描画詳細として隔離する。
- 保存形式をUI状態や描画ライブラリの内部形式から独立させる。
- 回帰計算を独立した純粋な計算領域として扱う。
- データ参照、モデル検証、変換、migrationを単体で検証可能にする。
- 保存・再読み込み、将来のUndo / Redo、schema migrationを同じモデル境界の上に構築できるようにする。

## 3. 全体構造と依存方向

```text
Data Grid
    ↓
Data Range / Data Binding Model
    ↓
Chart Model
    ├─ Axis Model
    ├─ Series Model
    ├─ Error Bar Model
    ├─ Trendline Model
    └─ Style / Layout Model
    ↓
Renderer Adapter
    ↓
Plotly.js

Chart Model ─────────────→ Persistence
     ↑                         │
     └──── load / migration ───┘

Chart Model / Data ───────→ Regression Engine
            ↑                      │
            └── Regression Result ─┘
```

矢印は原則としてデータまたは依存の流れを示す。上位の意味モデルはPlotly.jsをimportせず、Plotly側から意味モデルを書き換えない。

## 4. 正規状態

アプリの正規状態は次の2群で構成する。

1. **Project State**: 元データ、データ参照、Chart Model、および再編集に必要な設定。プロジェクトファイルへ保存する。
2. **Session / UI State**: 現在選択中の対象、開いているペイン、hover、ドラッグ中の寸法、ダイアログ状態、検証メッセージ等。原則として保存しない。

描画用Plotlyオブジェクト、回帰曲線のサンプル点、DOM参照、Reactのローカル状態をProject Stateの正規値にしない。これらはProject Stateから導出する。

Project Stateの更新は、意図が分かるactionまたはcommandを通して行う。v0.1でUndo / Redoを提供しない場合でも、UIコンポーネントが深いオブジェクトを直接変更する構造は避ける。これにより、将来は同じ更新単位を履歴へ記録できる。

## 5. レイヤーと責務

### 5.1 Data Grid

責務:

- クリップボードの表データを受け取り、行・列構造へ変換する。
- 数値、文字列、空セルを識別してDataset Modelへ渡す。
- 表の表示、選択範囲、列見出しを扱う。
- X、Y、誤差値の候補範囲を利用者が選択できるようにする。

Data GridはChart Modelへセル値を複製せず、Dataset ModelとData Binding Modelを介して参照する。グリッドの選択表示や編集途中の文字列はUI Stateであり、確定済みデータと分ける。

### 5.2 Dataset Model

責務:

- 貼り付けた元データを、stable IDを持つ表、列、行として保持する。
- 列順と行順、列名、セル値を保持する。
- Data Rangeが参照する対象を提供する。

v0.1では1つの表を基本とするが、プロジェクト形式はdatasetsの配列とし、将来複数表を追加してもChart Modelの参照方式を変更しない構造にする。

### 5.3 Data Range / Data Binding Model

責務:

- Dataset内の1次元値範囲を、`datasetId`、`columnId`、開始行ID、終了行IDで表現する。
- 系列のX/Y、X/Yエラーバー等の役割と値範囲の対応を表す。
- 参照先の存在、範囲順序、値数、必要な数値型を検証する。
- X/Y入れ替えをbindingの交換として行えるようにする。

Chart Modelはコピー済みの配列値ではなくbindingを保持する。Renderer AdapterとRegression Engineへ渡す前に、selector/resolverがbindingから現在の値ベクトルを解決する。

### 5.4 Chart Model

Chart ModelはScientific Chart Editorの意味を表す中心モデルであり、次を集約する。

- グラフ種類
- Axis Model
- Series Model
- Error Bar Model
- Trendline Model
- Style / Layout Model
- タイトル、凡例、サイズ

Chart ModelはPlotlyの`layout`、`trace`、`Data[]`、イベントオブジェクトを含めない。CSSクラス名、DOM寸法測定結果、Reactコンポーネント状態も含めない。

#### Axis Model

- stable IDと軸の次元（X/Y）
- タイトル
- scale（linear/log）
- 自動または明示した最小・最大
- 主目盛間隔（自動または固定値）・補助目盛間隔（なし、自動、または固定値）
- 目盛方向、反転
- 主・補助グリッド線
- 将来拡張可能な数値表示形式

軸を配列として保持し、各系列が`xAxisId`と`yAxisId`を参照する。v0.1ではX/Y各1軸だけを作成するが、この参照により第2軸を追加可能にする。

#### Series Model

- stable ID、名称、表示状態
- X/YのData Binding
- 参照するX/Y軸ID
- 色、線、マーカー、棒の書式
- X/Y Error Bar Model
- Trendline Modelの配列

グラフ種類はv0.1ではChart Modelのchart typeを基本とする。複合グラフは非目標であり、系列別の種類上書きは導入しない。

#### Error Bar Model

- 有効状態
- 方向（Series内のXスロットまたはYスロット）
- 誤差表現の種類
- 誤差値へのData Binding
- 必要な表示書式

誤差表現は`kind: symmetric`を明示し、その配下に値範囲を持つ。将来は`asymmetric`と正負別bindingを追加できるdiscriminated unionとする。

#### Trendline Model

- stable ID
- 回帰種類
- 方式固有パラメータ（多項式次数等）
- 式とR²の表示設定
- 曲線およびラベルの書式

単一系列に配列として保持する。v0.1のUIが1本に制限しても、将来の複数近似曲線で保存構造を変更しない。係数、R²、描画点等の派生計算結果は正規状態に含めない。

#### Style / Layout Model

- グラフの幅・高さ
- グラフタイトル
- 凡例
- 系列の線、マーカー、棒書式
- 背景や余白等、再編集に必要と確定した表示設定

書式値はScientific Chart Editorのenumおよび単位で表現し、Plotly固有文字列を正規値にしない。

### 5.5 State / Application Service

責務:

- Project StateとUI Stateを保持する。
- 貼り付け、系列追加、X/Y入れ替え、軸変更、リサイズ確定等の操作をProject Stateの更新へ変換する。
- 選択対象に応じて右側ペインの編集対象を決定する。
- model validatorの結果をUIへ公開する。
- Renderer、Persistence、Regressionの呼び出しを調整する。

Reactコンポーネントはこの層が公開するselectorとactionを利用し、PersistenceやPlotly.jsを直接呼ばない。

### 5.6 Regression Engine

責務:

- 解決済みX/Y数値ベクトルとTrendline Modelの設定を受け取る。
- 線形、多項式、指数、対数、べき乗回帰を計算する。
- 係数、R²、定義域、描画用評価関数またはサンプル点、診断情報からなる描画ライブラリ非依存の結果を返す。
- 必要点数、有限値、方式ごとの定義域、特異行列等を検証する。
- 式表示用の意味情報を返し、表示桁の整形とは分離する。

Regression EngineはPlotly.js、React、DOM、Persistenceに依存しない。同じ入力と設定には同じ結果を返す決定的な計算として実装する。

### 5.7 Renderer Adapter

責務:

- 有効なChart Model、解決済みデータ、回帰結果をRenderer-neutralな描画要求として受け取る。
- Scientific Chart Editorのグラフ種類、軸、系列、書式をPlotlyのtrace/layout/configへ変換する。
- Plotlyの選択・リサイズ等のイベントを、アプリケーション層が解釈できるrenderer-neutralなイベントへ変換する。
- SVG / PNG出力要求をPlotlyの出力機能へ橋渡しする。

Plotly.js固有の処理は`renderer/plotly/`境界内に閉じ込める。Plotlyの型をこの境界の外へ公開しない。Adapterの入力・出力interfaceはrenderer-neutralに定義し、将来別rendererを追加できるようにする。

Renderer Adapterはモデルを修正して辻褄を合わせない。不正モデルは事前検証で拒否し、Plotly都合の既定値が必要な場合は変換規則として明示する。

### 5.8 Persistence

責務:

- Project Stateを保存DTOへ変換し、JSONを生成する。
- JSON parse、schema判定、migration、構造検証、参照整合性検証、意味検証を行う。
- 有効な保存DTOを現在のProject Stateへ変換する。
- ブラウザのローカルファイル入出力を抽象化する。
- 未対応versionや不正ファイルを構造化エラーとして返す。

PersistenceはUIコンポーネントやPlotly.jsに依存しない。読み込みは全検証成功後にだけ現在のProject Stateを置換する、トランザクション的な処理とする。migrationの責務もPersistence内に置く。

保存DTOと内部モデルは概念を共有するが、同一型である必要はない。分離することで、内部リファクタリングとファイル互換性を切り離す。

### 5.9 Validation

検証を次の段階に分ける。

1. **Syntax validation**: JSONとして読み取れるか。
2. **Schema validation**: 必須field、型、enum、有限数等が正しいか。
3. **Referential validation**: dataset、column、row、axis、series等のID参照が存在するか。
4. **Semantic validation**: X/Y長、誤差値長、軸範囲、対数定義域、回帰条件等が整合するか。

検証結果はfield path、エラーコード、利用者向けメッセージを持てる構造とする。Rendererで発生した例外を通常の入力検証として利用しない。

## 6. 主要データフロー

### 6.1 貼り付けから描画

```text
Clipboard text
  → Paste parser
  → Dataset Model
  → Data Binding selection
  → Model validation / range resolution
  → Regression Engine（設定時のみ）
  → Renderer-neutral request
  → Plotly Adapter
  → Plotly.js
```

貼り付けparserはデータをPlotly配列に変換しない。X/Y選択を変更したときはbindingを更新し、同じDatasetから値を再解決する。

### 6.2 保存

```text
Project State
  → Persistence mapper
  → Current schema DTO
  → Validation
  → JSON serialization
  → Local file download/save
```

描画済みPlotlyオブジェクトや回帰キャッシュを逆変換して保存してはならない。

### 6.3 読み込み

```text
Local file
  → Size / JSON syntax check
  → schemaVersion dispatch
  → migration chain
  → schema / reference / semantic validation
  → Project State candidate
  → atomic state replacement
  → regression recomputation
  → rendering
```

途中で失敗した場合はcandidateを破棄し、現在のProject Stateを維持する。

### 6.4 リサイズ

ドラッグ中はUI Stateでプレビュー寸法を保持し、操作確定時に整数pixelの幅・高さとしてChart Modelへ1回反映する。PlotlyのDOMサイズを保存元にせず、Chart Modelの寸法を正とする。

## 7. UIモデル

画面は次の3領域を基本とする。

```text
┌───────────────┬────────────────────┬──────────────────┐
│ Data Grid     │ Chart Area         │ Format Pane      │
│ table / range │ rendered chart     │ selected target  │
└───────────────┴────────────────────┴──────────────────┘
```

UI Stateには、例えば次のdiscriminated unionで選択対象を持つ。

```text
none
chart(chartId)
axis(axisId)
series(seriesId)
errorBar(seriesId, dimension)
trendline(seriesId, trendlineId)
legend(chartId)
title(chartId)
```

右側ペインは選択対象から編集用view modelを選び、actionを通してProject Stateを更新する。Plotlyイベントが返すcurve index等はAdapter内でstable series IDへ変換し、UIがPlotlyの配列indexに依存しないようにする。

Phase 0-BではこのUIを実装しない。

## 8. 推奨ディレクトリ構成

```text
src/
├─ components/
│  ├─ data-grid/
│  ├─ chart-area/
│  └─ format-pane/
├─ model/
│  ├─ dataset/
│  ├─ binding/
│  ├─ chart/
│  └─ validation/
├─ state/
│  ├─ actions/
│  ├─ selectors/
│  └─ ui-selection/
├─ renderer/
│  ├─ renderer-adapter.ts
│  └─ plotly/
│     ├─ plotly-adapter.ts
│     ├─ trace-mapper.ts
│     ├─ layout-mapper.ts
│     ├─ event-mapper.ts
│     └─ export-adapter.ts
├─ regression/
│  ├─ regression-engine.ts
│  ├─ linear.ts
│  ├─ polynomial.ts
│  ├─ exponential.ts
│  ├─ logarithmic.ts
│  └─ power.ts
├─ persistence/
│  ├─ project-file-service.ts
│  ├─ dto/
│  │  └─ v0.1/
│  ├─ validation/
│  └─ migrations/
├─ application/
│  ├─ project-service.ts
│  ├─ chart-service.ts
│  └─ export-service.ts
└─ utils/
```

実装時に命名や分割単位は調整可能だが、`model`から`renderer/plotly`への逆依存、UIからPersistenceへの直接依存、RegressionからPlotlyへの依存を導入してはならない。

## 9. 依存ルール

- `model/`はReact、Plotly、ブラウザファイルAPIに依存しない。
- `regression/`は`model/`のrenderer-neutralな型だけに依存できる。
- `renderer/plotly/`はPlotlyに依存してよいが、Plotly型を外へ漏らさない。
- `persistence/`は保存DTO、migration、model mappingを所有し、ReactとPlotlyに依存しない。
- `components/`はapplication/stateの公開APIを利用し、model内部を直接変更しない。
- `application/`は各境界を調整するが、描画・計算・永続化の詳細を実装しない。
- stable IDを境界間の識別子とし、Plotlyのtrace indexや配列indexを永続参照に使わない。

依存ルールはlint、import規約、または境界テストで機械的に検査できる形へ発展させる。

## 10. Plotly.js依存の隔離方針

Plotly固有である次の項目は`renderer/plotly/`内に限定する。

- `Plotly.Data`、`Layout`、`Config`等の型
- trace type、mode、marker symbol、dash等へのmapping
- error barのPlotly表現
- axis range、tick、grid、log axisのPlotly表現
- Plotlyイベント名とpayload
- responsive resize、SVG / PNG出力API
- Plotlyの既定値やworkaround

Adapter変換は可能な限り純粋関数で構成し、同じChart Modelから期待するtrace/layoutが得られることをテスト可能にする。描画エンジン変更時は新Adapterを追加し、Project Stateと保存形式をmigrationしないことを目標とする。

## 11. Persistenceとmigration

schema versionごとの保存DTOを`persistence/dto/`に残し、migrationは古いDTOから次versionのDTOへの純粋関数の連鎖とする。読み込みの最終段でのみ現在のmodelへmappingする。

```text
v0.1 JSON DTO
  → migrate when required
  → current DTO
  → validate references and semantics
  → current Project State
```

内部モデル変更を理由に過去ファイルを直接書き換えない。保存時は現在versionで新規serializeする。未知fieldと未対応versionの方針は`project-format-v0.1.md`に従う。

## 12. テスト可能性の設計契約

Phase 0-Bではテストを実装しないが、後続実装は少なくとも次を独立して検証可能にする。

- クリップボード文字列からDatasetへのparse
- Data Bindingから値ベクトルへの解決
- Chart Modelの構造・参照・意味検証
- 各回帰方式と異常系
- Chart ModelからPlotly入力へのmapping
- Project Stateのserialize / deserialize round-trip
- 各schema migration
- 不正ファイル読み込み時に現在状態が変わらないこと
- 縦切りの保存、再起動、読み込み、SVG出力

renderer snapshotだけを正しさの根拠にせず、意味モデルとmappingを別々に検証する。

## 13. 最初の実装縦切り

最初に次の一本を全境界へ通す。

```text
Google Sheetsから表を貼る
→ Dataset Modelへ保持
→ X/Y Data Bindingを作成
→ 散布図Chart Modelを作成
→ 別列を対称Y Error Barへbinding
→ X/Y Axis Modelのmin/max/major stepを変更
→ Chart Modelのwidth/heightを変更
→ Plotly Adapterで描画
→ Persistenceでプロジェクト保存
→ アプリ再起動
→ parse/migration/validation後にProject Stateを復元
→ Regressionなしで再描画
→ Plotly Adapter経由でSVG出力
```

この縦切りでは、短期的な直結で境界を省略しない。特にDatasetからPlotly traceを直接生成する、ReactコンポーネントでJSONを組み立てる、Plotly layoutを保存する、という実装は禁止する。

縦切りが保存・再起動・SVGまで成立する前に、棒グラフ、複数系列、Xエラーバー、PNG、高度な回帰へ横展開しない。縦切り後は同じモデルとAdapterの拡張として順に追加する。

## 14. 確定事項と未確定事項

### 確定事項

- Chart ModelはScientific Chart Editor独自の意味モデルとする。
- Plotly.js固有処理と型は`renderer/plotly/`に隔離する。
- PersistenceとRegression EngineはUIおよびPlotlyから分離する。
- 元データとChart Modelを正規状態とし、描画入力と回帰結果は派生値とする。
- 系列、軸、行、列、近似曲線等の内部参照にはstable IDを使う。
- v0.1は1グラフを扱うが、軸参照と近似曲線配列は将来拡張可能にする。
- 読み込みは検証完了後に状態を一括置換する。

### 実装開始前に確定する事項

- State管理方式とcommand/historyの具体API
- runtime schema validation手段
- ID生成方式（UUID等）とテスト用決定的IDの注入方法
- Data Gridライブラリを使う場合の選定と、Dataset Modelとの境界
- Renderer Adapterのrenderer-neutral interface詳細
- 数値精度、回帰ライブラリ利用有無、曲線サンプリング規則
- 大規模データでの再計算、再描画、保存の性能予算
- SVG内フォント、PNG倍率、色表現等の出力規則

## 15. Phase 1実装で確定した構成

- Project StateはReactの`useReducer`と明示的なProject Actionで更新し、読み込み成功時だけ`load-project` actionで候補全体を置換する。
- productionのstable IDは`crypto.randomUUID()`で生成する。TSV parserと初期Project生成には`IdFactory`を注入でき、テストでは決定的IDを使う。
- 外部JSONはPersistence層の明示的なTypeScript type guardで構造検証した後、Model層の参照・意味検証へ渡す。`JSON.parse(...) as Project`だけの読み込みは禁止する。
- Plotly basic distributionのimport、Plotly型、Chart Modelからtrace/layoutへの変換、DOM描画、SVG出力は`src/renderer/plotly/`へ隔離する。
- Data GridはPhase 1ではTSV貼り付け、表表示、X/Y/Y Error列選択だけを担当し、セル値とbindingはDataset / Chart Modelを正規状態とする。
- Data Binding Modelは同一行のX/Y/Y Errorをzipしてから無効X/Y行を除外し、行対応のずれを防ぐ。Y Errorの妥当性は描画対象となるX/Y行だけで判定する。
- Y Error列の指定時に`null`、非`number`、非有限値、負値が1件でもあれば、Data Binding Modelは派生状態`showYErrorBars = false`と該当行ID一覧を返す。Renderer Adapterは系列全体の`error_y`を出力しない。散布点、Dataset、Chart Model上のbindingと`enabled`は変更せず、数値の0は有効値として保持する。
- runtime上限は256列・10,000行・プロジェクト5 MiB、グラフ幅360〜1,600px・高さ300〜1,200pxとする。

## 16. Phase 2書式編集アーキテクチャ

### 16.1 Selection Model

`src/state/selection.ts`にrenderer非依存のdiscriminated unionを置き、`chartId`、`axisId`、`seriesId`で対象を識別する。対象はchart、axis、series、Y error bars、legend、chart titleである。SelectionはReactのSession Stateとして保持し、保存・Undo対象にはしない。プロジェクト読み込み成功時は読み込んだchart IDのchart selectionへ戻す。選択UIの文字列keyはUI境界だけで相互変換し、不明または古いIDは安全なchart selectionへ戻す。

### 16.2 Style Modelと更新

- Axis Modelはscale type、reversed、主・補助intervalと表示、tick direction、axis line、grid、label fontを保持する。
- Series ModelはScientific Chart Editor固有のmarker shapeとline style enum、塗り／枠線、寸法を保持する。
- Error Bar Modelはbindingと`enabled`に加え、意味的な`style.visible`、色、線幅、cap sizeを保持する。無効誤差値による派生表示可否は保存しない。
- Chart Modelはpaper相当の背景とplot area背景、title font、legend positionをrenderer-neutralな値で保持する。
- Format PaneはProject Stateを直接mutateせず、すべて`ProjectAction`をReducerへ渡す。数値draft、選択、ドラッグpreviewはSession Stateである。

Plotlyのmarker symbol、dash、legend座標、log range表現は`renderer/plotly/plotlyAdapter.ts`でのみ変換する。`dash-dot`から`dashdot`、凡例の上下左右から座標への対応等をChart Modelへ逆流させない。Plotlyが真のcross tickを直接提供しないため、Phase 2 Adapterでは`cross`を内向きの長いtickとして近似するが、Model enumの意味は維持する。

### 16.3 対数軸validation

`validateLogAxes`は明示min/max、描画対象X/Y、および表示対象となるY error下端を検証する。0以下がある場合は件数付きissueを返す。UIは対数軸化、データ貼り替え、binding変更、誤差範囲再表示等の候補Projectに対して検証し、不適合操作をReducerへ渡さない。Persistenceのsemantic validationも同じ関数を使用し、不正な外部ファイルをatomic load前に拒否する。

### 16.4 互換性とリサイズ

Persistenceは`schemaVersion: "0.1"`の構造検証前に、Phase 2で追加したfieldが欠落している場合だけdefault hydrationを行う。明示された不正値はdefaultで上書きせず拒否する。これによりPhase 1 writerの`0.1`ファイルを読み込みつつ、現在writerは完全なStyle Modelを保存する。

リサイズ計算は`calculateResizedChartSize`という純粋関数で整数化と上限・下限clampを行う。ChartCanvasはpointer capture中のpreviewをUI Stateに保持し、pointer up時だけ`set-chart-size-complete` actionで幅・高さを同時更新する。

## 17. Phase 3A棒グラフ・Data Gridアーキテクチャ

### 17.1 Chart Typeと意味binding

Chart Modelの種類は`scatter | bar`、棒の向きは`vertical | horizontal`とする。Series Modelは既存の散布図`bindings.x/y`と独立した`barBindings.category/value/error`を保持する。グラフ種類切替時に空のbindingだけを対応する既存bindingから補完し、その後の縦横切替ではCategory / Value / Errorを一切付け替えない。

`resolveBarSeries`は同じ行位置でCategory / Value / Errorをzipしてから不正なCategory / Value行を除外する。誤差の妥当性は描画対象行だけで判定し、派生値`showErrorBars`と不正行IDを返す。Renderer Adapterは縦棒で`error_y`、横棒で`error_x`へ変換するが、このPlotly名をChart Modelへ保存しない。

### 17.2 Category AxisとRenderer境界

`isCategoryAxis(project, dimension)`を共通の派生判定とする。縦棒のX軸、横棒のY軸ではRendererがcategory axisを生成し、保存済みAxis Modelのnumeric range、interval、log、reverseを適用しない。値軸では0を自動extent候補に含め、明示boundがなければ0 baselineを維持する。明示minimumが0以外の場合はModelを変更せずUI warningを派生する。

棒のorientation、style、要素間隔percentageは独自の意味値を正規状態とし、Plotlyの`v` / `h`、`bargap`、bar trace、error directionは`src/renderer/plotly/`内だけで生成する。Phase 3D-1以降は固定trace widthを正規状態に持たない。

### 17.3 Data GridとPane Resize

Data GridはDatasetとbindingを読み取る表示・選択コンポーネントであり、セル表示用の複製状態を持たない。列強調ラベルは現在のChart Typeとbindingから派生する。表の固定見出し、固定行番号、スクロールはCSS上の表示責務である。

Data / Chart境界の幅はAppのSession Stateとし、`calculateDataPaneWidth`純粋関数が320〜720pxへclampする。Project Reducer、Persistence、Undo候補のChart Modelには含めない。対してグラフ自身のwidth/heightは引き続きChart Modelへ確定保存する。

### 17.4 Phase 1 / 2互換性

Persistence hydrationは`schemaVersion: "0.1"`を維持し、欠落した`chart.bar`、`series.barBindings`、bar opacityをdefault補完する。Phase 3D-1より前のbar gap / widthはSection 25のpercentageへmigrationする。旧scatterのX/Y/Y Error参照をCategory / Value / Errorの初期候補としてコピーする。明示された不正orientation、範囲外style、broken referenceは補正せず拒否し、validation成功後だけatomic loadする。

## 18. Phase 3B-1 editable gridとPaste境界

### 18.1 Active Cell

Active Cellは`{ rowIndex, columnIndex }`のSession Stateであり、A1を`{0,0}`とする。row 0はDatasetの`columns[].name`へ対応する見出し行、row 1以降は`rows[rowIndex - 1]`へ対応する。Data Gridはクリック・focus・Arrow / Tab / Enterでこの状態だけを更新し、Project Stateや保存ファイルへ混入させない。

### 18.2 Rectangular Paste Pipeline

```text
paste event
  → parseClipboardTsv（矩形 CellValue[][]）
  → applyRectangularPaste（範囲・上限事前検証、候補Dataset生成）
  → candidate Projectでlog等を検証
  → paste-range ProjectActionを1回dispatch
```

`parseCell`を単一セルの意味変換、`parseClipboardTsv`を行列構造の解釈として分離する。初回と追加Pasteは同じ`applyRectangularPaste`を使用し、旧`replace-dataset` actionは明示的な全置換/import用境界として通常Pasteから外す。

### 18.3 Atomicity・ID・binding

Paste関数は矩形形状、開始座標、最大256列・10,000データ行を候補生成前に検証する。失敗は新しいDatasetを返さず、UIはdispatchしないためProjectとActive Cellを維持する。成功時は既存Datasetを直接mutateせず、新しいDataset snapshotを生成する。

既存Dataset ID、Column ID、Row IDは位置が存続する限りコピーして維持し、拡張分だけ`crypto.randomUUID()`で追加する。Reducerは既存Datasetへの`paste-range`でChart Modelを変更しない。初回だけ既存の`projectWithDataset`を利用して先頭2列を初期binding候補にする。この構造により1 Paste = 1 history候補として将来のUndo / Redoへ接続できる。

### 18.4 Data Grid UI

Gridは空プロジェクトでもA1を初期active cellとして表示する。列記号行、見出し行、データ行、行番号を表示し、active cellを青い枠で示す。paste eventはfocusされたセルから親Gridへbubbleさせ、Ctrl+V / Cmd+Vをブラウザ標準経路で処理する。binding badgeはDatasetとChart Modelから引き続き派生し、部分Paste後に同じstable column IDを指す。

## 19. Phase 3B-2 数値軸設定境界

### 19.1 数値軸判定

`isNumericAxis(project, dimension)`をChart Typeとbar orientationから導出する。scatterはX/Yとも数値軸、vertical barはYだけ、horizontal barはXだけが数値軸である。Format Paneはこの判定で範囲・目盛り間隔・linear/logを提示し、Rendererは対になる`isCategoryAxis`判定でカテゴリ軸へnumeric rangeやintervalを渡さない。

### 19.2 Draft・候補検証・確定

```text
NumberDraftInput
  → blur / Enterで有限numberまたはAuto(null)候補を作る
  → prepareProjectActionで候補Projectを生成
  → validateAxisSettings（range・unit・log固定境界）
  → validateLogAxes（描画データ・誤差下端）
  → 成功時だけ元のProjectActionをdispatch
```

入力中の文字列とfield errorはFormat PaneのSession Stateであり、Chart Modelへ保存しない。不正候補ではdispatchせず、入力欄を直前の確定値へ戻して具体的なissueを表示する。検証処理は値をclamp・交換・0置換しない。

### 19.3 Model・Renderer・Persistence

正規状態は既存Axis Modelの`scale.minimum/maximum: number | null`、`ticks.majorInterval: auto | fixed`、`ticks.minorInterval: none | auto | fixed`であり、Plotlyの`range`、`autorange`、`dtick`はAdapter内だけで生成する。Phase 3B-2はschema fieldを追加せず`schemaVersion: "0.1"`を維持する。旧readerで必須だった軸fieldと既存default hydrationを変更しない。

## 20. Phase 3B-3 Cell Edit境界

### 20.1 Session Stateと編集開始

Data Gridは永続Project Stateとは別に、Active Cell、`CellEditSession { cell, draft }`、IME composition状態を持つ。ダブルクリック・Enter・F2ではDatasetから現在値を文字列として読み出し、通常文字入力では入力された最初の文字だけをdraftにして編集を開始する。React componentはdraftを描画するだけでDatasetを直接mutateしない。

```text
Active Cell + edit trigger
  → CellEditSession start / change（Session State）
  → Enter / Tab / blur
  → applyCellEdit（parseCell + candidate Dataset）
  → candidate Projectの既存検証
  → edit-cell ProjectActionを1回dispatch
```

EscapeはSession Stateだけを破棄するため、元Datasetを復元する処理自体を必要としない。IME composition中のkeydownは`isComposing`、composition eventで管理するref、互換用`keyCode: 229`で判定し、Enter / Tabを確定操作に変換しない。

### 20.2 単一セル更新とID・binding

`applyCellValue`は既存セルの場合、対象`ColumnModel`または`RowModel.cells[columnId]`だけをimmutableに複製する。Dataset ID、既存Column ID、既存Row IDは再生成しない。現在範囲外の単一セル編集は既存`applyRectangularPaste`へ1×1候補として委譲し、同じ上限・atomic拡張規則を利用する。

見出しセルのnullは空string、データセルの消去はnullである。Reducerの`edit-cell` / `clear-cell` actionは候補Dataset snapshotを一度だけ反映し、Chart Modelとstable column ID bindingを変更しない。Renderer用点列、無効誤差件数、警告は更新後のProjectから再導出する。

### 20.3 Keyboard・Paste責務

非編集中はArrow / TabをActive Cell移動、Enter / F2を編集開始、Delete / Backspaceを単一セル消去として扱う。編集中はinputへArrow / Backspaceを委ね、Enter / Shift+EnterとTab / Shift+Tabを確定・移動、Escapeをcancelとして扱う。editorのpaste eventはGridへ伝播させず通常のテキスト挿入とし、非編集中のGrid paste eventだけをPhase 3B-1のRectangular Paste pipelineへ渡す。

この分離により、直接編集、消去、矩形Pasteはいずれも操作単位のReducer actionになり、将来のhistory層はDOMイベントやセルごとの中間変更を記録せず確定snapshotだけを扱える。

## 21. Phase 3B-4 Data Orientationとrow binding境界

### 21.1 独立する3つの方向

Chart Modelの`dataOrientation: columns | rows`は、Datasetをどちらの一次元方向で読むかを表す。`chart.bar.orientation: vertical | horizontal`は描画方向、散布図`bindings.x/y`は変数の役割であり、相互に代用しない。行／列切替ではDataset Model、セル位置、row / column IDを変更せず、Renderer Adapter入力を生成するresolverだけを切り替える。

### 21.2 BarRowBindings

単一系列のrows modeは次のrenderer-neutralな参照を持つ。

```text
BarRowBindings
  ├─ datasetId
  ├─ categoryStartColumnId
  ├─ categoryEndColumnId
  ├─ valueRowId
  ├─ errorRowId?
  └─ labelColumnId?
```

カテゴリ列範囲はDatasetのcolumn配列順で両端を含む。値・誤差は同じカテゴリcolumn IDをkeyとして各rowのcellを読むため、無効Valueを除外しても位置対応を詰めない。解決済みBarPointのsource IDはcolumns modeではrow ID、rows modeではcategory column IDとなり、Plotly trace indexを意味参照に使わない。

`labelColumnId`は行選択UIだけの名称解決に使い、グラフ値へ混入させない。Phase 3B-4ではrowsへ初めて切り替える際に先頭column IDをlabel候補として補うが、Category / Value / Errorは推測しない。

### 21.3 Resolver・Renderer・検証

```text
Chart.dataOrientation
  ├─ columns → barBindingsを同一row位置でresolve
  └─ rows    → barRowBindingsを同一column位置でresolve
                         ↓
                 ResolvedBarSeries
                         ↓
       bar.orientation vertical / horizontal
                         ↓
                 Plotly Adapter
```

row resolverはカテゴリ範囲、value row、任意error rowをstable IDで解決する。無効Valueはそのcategory column IDだけを除外する。描画対象位置の無効Errorは件数を保持して全error表示を止めるが、DatasetもBarPointも修正しない。縦／横変換は従来どおりAdapterだけがY Error / X Errorへ対応させる。

Persistence validationはdata orientation enum、dataset / row / column参照、カテゴリ範囲順を検証する。欠落・削除済みIDまたは逆順範囲を含む外部ファイルはatomic load前に拒否する。セルが欠落する場合はnullとして派生Value / Error validationへ渡し、列を詰めて長さを合わせない。

### 21.4 UIと切替

Data Paneは「データ系列の方向」の列／行radioを持つ。columns modeはカテゴリ・値・誤差範囲、rows modeはカテゴリ範囲・値・誤差範囲を提示する。Gridはカテゴリcolumn headerに`CATEGORY`、value row headerに`VALUE`、error row headerに`ERR`の文字badgeを表示する。

`set-data-orientation` actionはinactive側bindingを破棄しない一方、columnsとrowsの間で意味bindingを自動変換しない。Scatterではrows選択を無効化し、rows状態からScatterへ変更するactionは`dataOrientation`だけをcolumnsへ戻す。この構造により、Dataset転置や誤った自動割当を行わず、将来Scatter rows resolverを同じChart fieldへ追加できる。

## 22. Phase 3B-5 rows mode表示境界

Phase 3B-5では`BarRowBindings`を変更せず、Data Paneに表示用のtranslation境界を置く。`categoryStartColumnId`と`categoryEndColumnId`は1つの「カテゴリ範囲」fieldとして描画し、stable IDから現在のDataset順を解決して`B1:F1`形式を派生表示する。開始・終了selectorは暫定入力部品であり、将来は同じfieldのcallbackをGrid範囲選択へ接続できる。

`labelColumnId`はProject Model内の表示補助参照であり、通常UIの編集対象にしない。行候補label helperは次の順序で解決する。

```text
有効な保存済みlabelColumnId
  → なければDataset先頭column ID
  → 対象cellがstring / numberなら行番号へ併記
  → null / 空文字なら行番号だけ
```

この表示helperはDatasetやbindingを変更しない。Value / Errorのselectorは同じhelperを利用して「値」「誤差範囲」として表示し、Errorのnull bindingは「なし」とする。Model enum、Reducerのstable ID action、runtime validation、Resolver、Plotly Adapter、PersistenceはPhase 3B-4のままである。

## 23. Phase 3C 軸書式・プロット領域境界

### 23.1 renderer-neutral Style Model

Axis ModelはPlotlyのaxis objectを保持せず、次の意味構造を正規状態とする。

```text
Axis
  ├─ title { visible, text, style { family, sizePx, color, bold } }
  ├─ ticks
  │    ├─ major/minor interval・visible
  │    ├─ direction
  │    └─ majorLengthPx / minorLengthPx / lineWidthPx
  ├─ labels { visible, family, sizePx, color, bold, angleDeg }
  ├─ numberFormat
  │    ├─ auto
  │    ├─ integer
  │    ├─ decimal { decimalPlaces }
  │    └─ scientific { decimalPlaces }
  ├─ line { visible, color, widthPx }
  └─ gridLines
       ├─ majorVisible / minorVisible
       └─ majorStyle / minorStyle { color, widthPx, style }

Chart.plotArea
  ├─ border { visible, color, widthPx }
  └─ margin { mode, topPx, rightPx, bottomPx, leftPx }
```

grid styleは`solid | dash | dot`、margin modeは`auto | manual`であり、Plotlyのdash値、shape、paper座標、tickformat文字列をModelへ混入させない。

### 23.2 UI action・検証

Format Paneは意味groupごとにProjectActionを発行し、deep mutationを行わない。checkbox、色、enum、文字列は即時、数値はdraft確定後に`prepareProjectAction`へ渡す。候補Projectに対して軸style範囲、数値書式、小数桁、角度、プロット枠線、余白と最小プロット寸法を検証し、成功した単一actionだけをReducerへ確定する。この粒度は将来のhistory層で1操作として記録できる。

数値軸／カテゴリ軸は既存`isNumericAxis` / `isCategoryAxis`から導出する。カテゴリ軸ではrange、interval、log、number format、minor numeric axisをRenderer入力へ渡さない一方、ラベル角度・font、軸線、主grid、タイトルは共通Styleを適用する。

### 23.3 Renderer Adapter

Plotly Adapterだけが、number formatからd3 tickformat、grid styleからdash、Font ModelからPlotly font、plot borderからpaper座標のrect shape、Margin Modelからlayout margin / automarginへ変換する。手動marginではaxis automarginを無効、自動marginでは保存された基本余白を渡しつつaxis automarginを有効にする。同じ`toPlotlyFigure`を画面とSVG exportが利用するため、export専用のChart Model変更を行わない。

`cross` tickは旧Model値として受理するが、AdapterはPlotlyで表現可能なinsideへ互換変換する。新規UIはcrossを選択肢にせず、旧値を開いた場合だけ互換状態を説明する。

### 23.4 Default hydration

Phase 3C以前の`0.1`ファイルで新fieldが欠落する場合、Persistence境界がAxis title style、tick length / width、label visibility / bold / angle、number format、major/minor grid style、plot border / marginを安全なdefaultで補う。明示された不正enum、型、範囲、色は補正せず、semantic validation完了後だけatomic loadする。

## 24. Phase 3D Export・軸文字配置境界

### 24.1 Axis Model拡張

Axisの目盛ラベルと軸タイトルを別責務のまま拡張する。

```text
Axis.labels
  ├─ visible / font / bold / angleDeg
  ├─ position: outside | inside
  └─ distancePx

Axis.title
  ├─ visible / text / font style
  └─ distancePx
```

`position`と`distancePx`はScientific Chart Editorの意味値であり、Plotlyのproperty名をModelへ採用しない。ProjectActionはlabel style更新またはaxis title distance更新を1操作としてReducerへ渡す。0〜100pxの有限値を候補Projectで検証し、失敗時は直前状態を維持する。

### 24.2 Renderer Adapter mapping

Plotly Adapterはlabel positionを`ticklabelposition`、label distanceを`ticklabelstandoff`、title distanceを`title.standoff`へ変換する。カテゴリ軸と数値軸で同じ文字配置契約を使用する。`toPlotlyFigure`は通常描画と画像出力の共通入口であり、透明背景の一時overrideだけを任意optionとして受け取る。

Auto Marginではaxis `automargin`を有効にし、距離を含めた描画余白をRendererへ委ねる。Manual Marginでは`automargin`を無効にして保存済み上下左右値を優先し、AdapterがChart Modelを補正しない。

### 24.3 Export境界

```text
Toolbar Export Option（Session State）
  ├─ format: png | svg
  ├─ pngScale: 1 | 2 | 3
  └─ background: current | transparent
                ↓
prepareImageExport（pure conversion）
                ↓
Chart Model → Plotly Adapter → export専用一時描画
                ↓
Plotly Renderer → downloadImage
```

RendererはChart Modelの論理width / heightとexport scaleを別値として扱う。透明背景はexport専用Figureにだけ設定する。画面上のPlotly instanceやChart Modelを一時的に書き換えず、完了・失敗のどちらでも一時DOMをpurgeして破棄する。PNG / SVGは同じAdapterを通るため、データ、軸、誤差範囲、ラベル、タイトル、grid、marginの意味配置を共有する。

Export Option、進行状態、選択形式はProject StateやSelection Modelへ混入させない。将来JPEG / PDF等を追加する場合も、Project ModelではなくこのRenderer-neutralなexport境界を拡張する。

## 25. Phase 3D-1 Bar Gap Width境界

Chart Modelは1系列棒グラフの要素間隔を`bar.gapPercent`として保持する。これは`0..500`のrenderer-neutralなpercentageであり、Plotlyの`bargap`、trace `width`、offsetを正規状態にしない。

```text
Chart.bar.gapPercent
        ↓
barGapPercentToPlotlyGap
        ↓
Plotly layout.bargap = gapPercent / (100 + gapPercent)
```

Adapterはbar traceへ固定`width`を設定せず、Plotlyのcategory slot内の自動幅を利用する。したがってGap Widthが増えるほど`bargap`は単調増加し、自動棒幅は単調減少する。変換はorientationに依存せず、縦棒・横棒で同じである。Error Bar、Category、軸、gridは同じtrace / layout mappingを維持する。

Format Paneは棒系列選択時に「要素の間隔 (%)」を提示し、確定値を単一`set-bar-gap-percent` actionでReducerへ渡す。Action Guardは0〜500の有限値を候補Projectで検証し、無効値をatomicに拒否する。この1操作粒度は将来のhistory層へ接続できる。

Phase 3D以前の`0.1` readerは固定trace widthに相当した`series.style.bar.widthRatio`を優先してGap Widthへ変換する。固定widthがなければ旧`chart.bar.gapRatio`から変換し、両方なければ旧既定表示相当の25%を補う。旧値が新上限を超える場合だけ500%へmigrationする。正規化後のProject Stateと次回保存JSONにはlegacy fieldを残さない。明示された旧fieldの型・旧許容範囲違反は救済せず拒否する。

## 26. Phase 3D-3 Axis UI用語境界

Format Paneは数値軸の`scale.minimum / maximum`を「範囲」の「最小値／最大値」、`ticks.majorInterval / minorInterval`を「目盛り間隔」の「主目盛間隔／補助目盛間隔」として表示する。これはUI terminologyだけの対応であり、Axis Model、ProjectAction、validation code、Persistence schema、Renderer Adapterのfield名や責務は変更しない。`isNumericAxis`による表示境界を維持し、カテゴリ軸にはこれらのnumeric-only sectionを生成しない。

## 27. Phase 3D-4 Autosave境界

### 27.1 責務分離

```text
Project State変更
      ↓ 1,000ms debounce
既存Project Serializer
      ↓
Autosave Manager
      ↓
AutosaveStorage interface
      ↓
IndexedDB Adapter

起動時 IndexedDB record
      ↓
既存parse / hydration / validation
      ↓
成功時だけ load-project action（atomic restore）
```

Autosave Managerはdebounce、書込み順序、世代管理、状態通知を担当し、IndexedDB APIを知らない。IndexedDB Adapterはdatabase / transactionだけを担当し、Project構造を解釈しない。UIはAutosave Managerを介し、IndexedDBを直接操作しない。

### 27.2 SnapshotとSession State

監視対象はReducerが確定した現在のProject State snapshotである。正式保存とautosaveは同一Project envelope、hydration、structure validatorを共用する。正式保存は完成に必要なbindingも要求し、autosaveは`binding.required` / `errorBar.required`だけを回復可能な未完成状態として許可する。参照整合、軸、書式、ID、寸法等の安全性検証は共通であり、Project形式を二重化しない。History全体は保存しない。Selection、Active Cell、Cell Draft、IME composition、Format Pane draft、Data Pane幅、resize preview、export option、status messageはReducer外のSession Stateとして除外される。

書込みは直列化し、先行write中に新しいsnapshotが確定した場合は後続writeへ送る。新規作成はpending timerをcancelし、開始済み旧writeの後へ削除をqueueする。同時にgenerationを進め、旧write完了時の`onSaved` / status callbackを無視する。ページ離脱時だけの非同期writeには依存せず、通常のdebounceを主契約とする。

### 27.3 起動・正式読込・新規作成

起動中は利用者編集と復元が競合しない待機状態を表示する。valid recordだけを安全なSelectionとともに一括反映する。invalid recordは現在Projectを変更せず削除し、初期Projectで編集を開始できる。IndexedDB read / write失敗もProject操作を止めず、statusとして通知する。

正式Project読込は既存atomic load成功後に同じProjectを即時autosaveする。正式保存はautosaveを維持する。新規作成は確認後、初期ProjectをReducerへ一括反映し、空Projectは正式serializerの有効条件外であるためautosave recordを削除して古い作業復元snapshotを残さない。

### 27.4 制約とPrivacy

Autosaveはbrowser origin内のIndexedDBだけを利用し、ネットワーク送信しない。Phase 3D-4ではBroadcastChannel等によるmulti-tab arbitrationを持たず、同時タブはlast successful writer winsである。

## 28. Phase 3D-5 Formal File Persistence境界

### 28.1 保存・Open経路

```text
Project State
  ↓ strict Project Serializer
Formal File Persistence
  ├─ current handleあり → permission → createWritable → write → close
  ├─ handleなし / Save As → showSaveFilePicker → write
  └─ API非対応 → Blob download

showOpenFilePicker / file input
  ↓ File read + size check
既存parse / hydration / validation
  ↓
成功時だけProject・Selection・File Sessionをatomic更新
```

`formalProjectFiles`はcapability detection、picker、permission、handle read/write、fallback選択、shortcut解釈を担当する。React ToolbarはPlotlyやFile System Access APIを直接呼ばず、PNG / SVG Renderer exportとも分離する。

### 28.2 File Sessionとdirty

Current File Sessionは`handle | null`、file name、最後に正式保存したcanonical Project snapshotを持つ。dirtyは現在のRecovery Project snapshotと最後の正式snapshotの差から導出する。autosave callbackは正式snapshotを変更しないためdirtyをfalseにしない。Formal Save / Save As / Open成功だけがsnapshotを更新し、新規作成はhandleとsnapshotを解除する。

FileSystemFileHandleはProject Stateへ混入させず、IndexedDB `file-sessions/current-file-handle`へcanonical snapshotとともに保存する。Autosave storeとは分離する。起動時はautosave Projectがvalidに復元された場合だけhandle metadataを読み、permissionが`granted | prompt`ならSessionへ戻す。`denied`またはmetadata不正ならrecordを削除する。

### 28.3 失敗・Fallback・Shortcut

writeは`close()`成功後だけformal statusを`保存しました`へ進める。write例外では可能ならstreamをabortし、Project、autosave、current handle、dirtyを維持する。permission拒否は「名前を付けて保存」を案内する。

API非対応ではdownloadとfile inputを利用し、上書き可能とは表示しない。fallback保存後の同一Sessionではfile nameと正式snapshotを保持するがhandleはnullのため、次回保存もdownloadとなる。F5後は保存先を再指定する。

Keyboard shortcutはpure resolverでCtrl / Cmd + SとShift併用を判定する。composition中、Alt併用、S以外は処理せず、valid Projectだけ正式保存handlerへ渡す。

## 29. Phase 3D-6 Renderer Interaction Policy

`renderer/plotly/plotlyAdapter`が生成する共通configで`scrollZoom: false`を固定する。Scatter、縦棒、横棒、画面描画、PNG／SVG用Figureは同じconfig生成経路を使用する。UI componentはwheel eventを捕捉・`preventDefault`せず、グラフ上でもbrowserの通常page scrollを維持する。

wheel操作からProject actionをdispatchする経路は持たない。軸範囲変更はAxis Format Paneを正規経路とし、scroll interactionはProject、autosave、formal dirty snapshotから分離する。`responsive: false`、`displayModeBar: false`は維持し、`dragmode`と`doubleClick`の既存既定動作はPhase 3D-6では変更しない。

## 30. Phase 3D-7 Temporary Plot ViewとReset境界

Drag ZoomはPlotly element内部だけに存在するtemporary viewであり、Project Reducerへactionを送らない。`toPlotlyViewResetLayout(Project State)`は共通Adapterの正式axis layoutからX/Y軸だけを抽出し、`resetPlotlyView`が`Plotly.relayout`で画面へ適用する。固定range、Auto、category axisの判定は通常描画と同じAdapter経路を使う。

Plotly既定の`doubleClick: "reset+autosize"`は操作回数によってinitial rangeとAuto rangeを切り替えるため、configでは`doubleClick: "reset"`を明示する。これによりダブルクリックは直近の正式描画rangeへ戻り、「表示をリセット」buttonのModel由来reset layoutと意味結果を統一する。Drag Zoomの既定drag modeと`scrollZoom: false`は維持する。

ResetはProject、Selection、autosave、dirty snapshotを変更しない。export rendererはDOM上のtemporary viewを読まず、Projectから別の正式Figureを生成するため、PNG／SVGへZoomを混入させない。
