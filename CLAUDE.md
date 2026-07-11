# Overview

- このプロジェクトの目的は、汎用的な目的に使えるテンプレートとなるリポジトリをつくることです。
- このアプリは、SPA＋CSRの個人向けのアプリです。
- バックエンドはGo+PocketBase **v0.39+**、frontendは、solid.js + **tailwind v4**で書かれています。

## Rules

- データベースのマイグレーションはPocketBaseのWEB UIから行うのでマイグレーションコードを作成する必要はまったくない。
- When fixing bugs, add a failing regression test first.
- All errors are user-facing, so messages should be clear.
- Keep functions small and focused.
- Module files should re-export what's needed, hide implementation details.
- Don't persist changes to the database during drilling. Use the cache.
- Don't use timezones: dates are naive for a reason. Due dates etc. are more like the dates in a journal entry than precise points in time.

# Work in Progress
- reactのrrlueビルダをSolid.js用に。移植しようとしている。規模が大きいので段階的に進めていきましょう。

まず技術スタックの差分を整理すると、react-rrule-builder-tsは今のkitharaには要らない重量級の依存（MUI, MUI x-date-pickers, zustand, yup, luxon+adapter抽象化）を大量に抱えています。CLAUDE.mdの「日付はnaive」「保守性重視」という方針とも合わせると、単純にコンポーネントを1:1で置き換えるのではなく、**移植の過程で依存を削ぎ落とす**のが良さそうです。

### 落とす/変える依存の方針（叩き台）

| 元の依存 | 方針 | 理由 |
|---|---|---|
| MUI一式 | ネイティブHTML + Tailwind | kitharaは既にNavBar/Button/LoginがプレーンHTML+Tailwind |
| MUI x-date-pickers + luxon adapter | ネイティブ `<input type="date">` | kitharaは日付をnaiveに扱う方針。タイムゾーン抽象化は不要 |
| zustand | Solidの `createStore`（solid-js/store） | Reactのフック文化に依存した設計をSolidのプリミティブに素直に置き換える |
| yup | 手書きバリデーション（if文） | ロジックが小さいので依存を追加する価値が薄い |
| rrule (rrule-go相当) | **そのまま維持** | フレームワーク非依存。ロジックの核なので変更不要 |
| lodash (isNil等) | 素のJS | `!= null` で十分 |

この方針で進めてよいか、後で気になれば都度調整しましょう。

---

## 段階的な移植プラン

### Stage 1 — フレームワーク非依存部分の移植（ロジック層）
Reactに依存しない純粋なTS/JSをまず移す。ここが一番リスクが低く、テストも書きやすい。
- `Repeat.types.ts`（Weekday, Months, MonthByなどのenum/型） → ほぼそのままJSDocコメント付きJSかTSで移植
- `End.types.tsx`（EndType, EndDetails） → 同上
- `Repeat/utils.ts`（テキストマッピング, addOrRemoveFromArray, safeParseInt） → そのまま
- `buildRRuleString.ts` → **luxon adapter除去**、素の`Date`を受け取る形に書き換え
- バリデーション（yupスキーマ） → 手書き関数に置き換え

この段階の成果物はSolidにもReactにも依存しない`.js`/`.ts`ファイル群。単体テスト（vitest）もここで書けると安心。

### Stage 2 — 状態管理の移植
- Zustandの`builderStore.tsx`をSolidの`createStore`ベースに書き換え
- Reactの`Context + Provider`パターンが必要か検討（kitharaは1画面に1つのRRuleBuilderで足りそうなら、Context無しでシンプルな`createStore`をコンポーネント内に持たせるだけで十分かもしれない）
- `setStoreFromRRuleString`（既存RRULE文字列からのリハイドレート）のロジックはStage 1の関数を呼ぶだけなので機械的に移せる

### Stage 3 — UIコンポーネントの移植（末端から）
依存関係の少ない葉コンポーネントから順に：
1. `Inputs/IntervalTextInput` → `<input type="number">`
2. `Inputs/SelectDayWeek`, `SelectMonth`, `SelectPosition`, `SelectDayCalendar` → `<select>`
3. `RepeatDaily`, `RepeatHourly`（一番単純） → `RepeatWeekly` → `RepeatMonthly` → `RepeatYearly`（一番複雑、レスポンシブレイアウトロジック含む）
4. `Repeat.tsx`（頻度セレクト + 上記の出し分け）
5. `End.tsx`（終了条件: never/after/on）
6. `RRuleBuilder.tsx`（開始日ピッカー + 上記全部を統合）

`useResponsiveRowLayout.ts`はDOM測定ベースのロジックで、Solidでも`onMount`+`ResizeObserver`でほぼそのまま移せそう。

### Stage 4 — テスト移植
- 既存のvitestテスト（`utils.test.ts`, `buildRRuleString.test.ts`, `validationSchema.test.ts`, `useResponsiveRowLayout.test.ts`）はStage 1の純粋関数が対象なので、ほぼそのまま移せる
- コンポーネントテスト（`@testing-library/react`ベース）は`@testing-library/solid`相当に書き換えが必要（後回しにして良い部分）
- frontend側にはまだvitestが入っていないので、導入するかは別途判断

### Stage 5 — kitharaへの統合
- 配置場所決定（例: `frontend/src/components/RRuleBuilder/`）
- 実際の画面（習慣・イベント作成フォームなど）への組み込み
- PocketBaseのスキーマにRRULE文字列を保存するフィールドを追加するかの検討（これは別タスク）

---

## 進め方の提案

Stage 1から着手するのが良さそうです。特に`buildRRuleString.ts`と型定義・utilsは依存が少なく、テストも既にあるので移植の正しさを確認しやすいです。

Stage 1から始めてよければ、`Repeat.types.ts`と`utils.ts`の移植から着手します。それとも先に依存方針（zustand/yup/luxonを本当に落とすか）を確定させたい部分があれば教えてください。
