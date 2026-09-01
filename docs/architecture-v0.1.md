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

棒のorientation、style、gap、widthは独自enum／比率を正規状態とし、Plotlyの`v` / `h`、`bargap`、bar trace、error directionは`src/renderer/plotly/`内だけで生成する。

### 17.3 Data GridとPane Resize

Data GridはDatasetとbindingを読み取る表示・選択コンポーネントであり、セル表示用の複製状態を持たない。列強調ラベルは現在のChart Typeとbindingから派生する。表の固定見出し、固定行番号、スクロールはCSS上の表示責務である。

Data / Chart境界の幅はAppのSession Stateとし、`calculateDataPaneWidth`純粋関数が320〜720pxへclampする。Project Reducer、Persistence、Undo候補のChart Modelには含めない。対してグラフ自身のwidth/heightは引き続きChart Modelへ確定保存する。

### 17.4 Phase 1 / 2互換性

Persistence hydrationは`schemaVersion: "0.1"`を維持し、欠落した`chart.bar`、`series.barBindings`、bar opacity / widthだけをdefault補完する。旧scatterのX/Y/Y Error参照をCategory / Value / Errorの初期候補としてコピーするが、旧fieldは変更しない。明示された不正orientation、範囲外style、broken referenceは補正せず拒否し、validation成功後だけatomic loadする。
