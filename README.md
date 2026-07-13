# Cithara

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/asano69/cithara)


## Introduction 
<img src="frontend/public/favicon.svg" width="100" align="right" />
Cithara (Kitara) is a reminder app designed to help people maintain and improve their daily habits and routines. To ensure that recurring habits, household chores, and periodic events are not overlooked, it allows users to define recurrence rules for events using iCalendar (RFC 5545) and sends notifications through a message server (Gotify).

Many well-designed task managers offer a repeat option based on the completion date, but configuring such behavior is often somewhat cumbersome. Cithara places particular emphasis on making it easy to change the reference date from which a recurrence interval is calculated.

Cithara does not concern itself with whether a recurring task was actually completed. It simply tells you, once a week, that something is due today. If you completed the task yesterday, complete it today, or plan to do it tomorrow, you can reset the schedule around that date as many times as you like. Cithara is a tool for creating opportunities to take action.

Cithara can also send notifications for one-time events. However, in such cases, a conventional ToDo app or calendar may be a better fit. Cithara is focused on supporting the formation and maintenance of recurring behaviors, and one-time notifications are not at the core of its scope.


Cithara (きたら) は、生活習慣を整えることを目的としたリマインダーアプリです。定期的に行いたい習慣・家事・行事をやり逃さないように、イベントに対してiCalendar(RFC 5545)の反復規則を設定し、メッセージサーバ（Gotify）に通知を送信します。

よく考えられたタスクマネージャには「完了日を基準に繰り返す」というリピート機能がありますが、その設定は少し面倒なことが多いです。このアプリは、繰り返し間隔の基準日を容易に変更できることを重視しています。

Citharaは繰り返しタスクを実行したか、していないかは気にしません。ただ1週間に1回、今日やるべきであることを告げてくれます。もし、そのタスクを昨日やったら/今日やったら/明日やるつもりなら その日を基準に何度でもやり直すことができます。
Cithara は行動を起こすための機会を発生させる道具です。

Citharaは、一回限りのイベントに対しても通知できますが、そのような場合はふつうのToDoアプリやカレンダーを使ったほうが良いかもしれません。Citharaは、反復行動の形成に焦点をあており、1回限りの通知はスコープの中心ではありません。



## Desing

スケジュールはDB上に保存しない
- アプリ起動時にDB上のRRuleをすべてロードしてteambition/rrule-goで評価し、計算結果をスケジュールとしてメモリ上に保存する。
- 予定時刻が来たらサーバから通知を発火する。
- DBのDTSTARTや、RRULEの値が変化したら、そのたびにイベントスケジュールを再計算する。

UTCとローカルタイムの扱い
- サーバではローカルタイムを扱わずUTCでイベントスケジュールを計算する。一方で、クライアントではローカルタイムを中心に表示する。
- DBに、ローカルタイムが入らないようにする。つねにUTC時刻を扱うように徹底する。
- ユーザのタイムゾーン情報は、DBにユーザプロファイルの一部として保存し、基本的にブラウザのタイムゾーンAPIの情報を信用しない。
- クライアントは、サーバから受け取ったタイムゾーン情報をもとに、ローカルタイムとUTC時刻の変換計算を行う。
- ウェブUI上では、ローカルタイムを表示する。サーバに時刻情報を送信したり受信したりするときに、タイムゾーン変換関数を実行する。

カードの並び替え
- LexoRank を使う方法もあるが、イベントの数は1000件を超えないだろうから、position: number で変更したものをすべて更新するやりかたでよい。
- DB上でpositionにたいしてユニーク制約を設定しないことがポイント。そうしないと更新の非同期処理ができない。

### データベース設計
notes
- 反復するタスク・イベントを登録する。
- DTSTARTは、UTC (Zulu) で保存する。形式は 20260711T164700Z はRFC5545の仕様で扱える形式。

notifications
- gotifyなどの通知サービスの接続情報を保存。できれば暗号化して保存。現状は平文。


### ルート設計
- ホーム（イベント調整ページ）
- 新規イベント登録ページ
- イベント詳細編集ページ
- イベント一覧ページ

デバッグ:
- notification/testと、shedule/debugがある。serve.goのハンドラを見ればわかる。

## Plan

- [x] CLIで、github.com/teambition/rrule-go のライブラリの振る舞いを実験するプログラムを書く。
- [x] react-rrule-builder-ts をSolid.JS用に移植する。
- [ ] cel-expr/cel-go の検討
- [ ] note画面では、rruleビルダーとrrule式を双方向バインドして、どちらを編集してもよいようにする。ただしRRULE式が手動で編集されている場合はそちらを尊重するようにする。
- [ ] Notifierを選択可能にする
- [ ] TimeZoneを設定可能にする。（現在、手動で、settingsテーブルに、TZ, Azia/Tokyo と登録する必要がある。（厄介すぎ。せめて初期化時にデータを自動挿入してほしい）
- [ ] Gotifyの優先度を設定できるようにする
- [ ] Enable/Disableの設定をできるようにする
- [ ] Noteのフィルタとソートをできるようにする
- [ ] タグを設定できるようにする
- [ ] helathzエンドポイントでアプリの状態を監視可能にする。

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

## Tech Stack

Frontend: Solid.js, Tailwind v4
Backend: Go/PocketBase v0.39+

### RRule Engine

A synchronized implementation of recurrence logic exists on both sides of the stack:
- Server: [teambition/rrule-go](https://github.com/teambition/rrule-go) for high-performance schedule evaluation.
- Client: [jkbrzt/rrule](https://github.com/jkbrzt/rrule) (JS) for real-time preview of next occurrences in the UI.
- For details, see RRule Engine.

UI
- https://github.com/dcantatore/react-rrule-builder-ts  
