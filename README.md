# Kithara

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/asano69/kithara)


## Introduction 
<img src="frontend/public/favicon.svg" width="100" align="right" />

Kithara (きたら) は、生活習慣を整えることを目的としたリマインダーアプリです。定期的に行いたい習慣・家事・行事をやり逃さないように、イベントに対してiCalendar(RFC 5545)の反復規則を設定し、メッセージサーバ（Gotify）に通知を送信します。

よく考えられたタスクマネージャには「完了日を基準に繰り返す」というリピート機能がありますが、その設定は少し面倒なことが多いです。このアプリは、繰り返し間隔の基準日を容易に変更できることを重視しています。

Kitharaは繰り返しタスクを実行したか、していないかは気にしません。ただ1週間に1回、今日やるべきであることを告げてくれます。もし、そのタスクを昨日やったら/今日やったら/明日やるつもりなら その日を基準に何度でもやり直すことができます。
Kithara は行動を起こすための機会を発生させる道具です。

Kitharaは、一回限りのイベントに対しても通知できますが、そのような場合はふつうのToDoアプリやカレンダーを使ったほうが良いかもしれません。Kitharaは、反復行動の形成に焦点をあており、1回限りの通知はスコープの中心ではありません。



## Desing

- アプリ起動時にDB上のRRuleをすべてロードしてteambition/rrule-goで評価する。
- 予定時刻が来たら通知を発火する。
- helathzエンドポイントでアプリの状態を監視可能にする。


## Plan

- [ ] CLIで、github.com/teambition/rrule-go のライブラリの振る舞いを実験するプログラムを書く。
- [x] react-rrule-builder-ts をSolid.JS用に移植する。
- [ ] cel-expr/cel-go の検討

## Recurrence Rule

builder
- “Fafruch/react-rrule-generator: [NO LONGER MAINTAINED] Recurrence rules generator form built with React”. GitHub, [https://github.com/fafruch/react-rrule-generator](https://github.com/fafruch/react-rrule-generator), (Accessed 2026-07-12)
- “React RRule Generator”. fafruch.github.io, [https://fafruch.github.io/react-rrule-generator/](https://fafruch.github.io/react-rrule-generator/), (Accessed 2026-07-12)
- “dcantatore/react-rrule-builder-ts: rrule component for react with mui”. GitHub, [https://github.com/dcantatore/react-rrule-builder-ts](https://github.com/dcantatore/react-rrule-builder-ts), (Accessed 2026-07-12)
- “RRuleBuilder - Primary ⋅ Storybook”. dcantatore.github.io, [https://dcantatore.github.io/react-rrule-builder-ts/?path=/story/rrulebuilder--primary](https://dcantatore.github.io/react-rrule-builder-ts/?path=/story/rrulebuilder--primary), (Accessed 2026-07-12)

tester
- “RRULE Tester — iCalendar Recurrence Rule Expander”. AtlasClock Developer Tools, [https://www.atlasclock.com/rrule/](https://www.atlasclock.com/rrule/), (Accessed 2026-07-12)
- “RRULEビルダー | 無料オンライン繰り返しルール生成ツール | Toolsbase”. Toolsbase, [https://toolsbase.dev/ja/time/rrule-builder](https://toolsbase.dev/ja/time/rrule-builder), (Accessed 2026-07-12)
- “Recurring Date Generator”. YouCalc, [https://youcalc.com/en/date-time/recurring-date-generator/](https://youcalc.com/en/date-time/recurring-date-generator/), (Accessed 2026-07-12)

### Tech Stack
Frontend: Solid.js, Tailwind v4
- https://github.com/jkbrzt/rrule
Backend: Go/PocketBase v0.39+

---

=> https://github.com/teambition/rrule-go  
=> https://github.com/jkbrzt/rrule  
=> https://github.com/dcantatore/react-rrule-builder-ts  
