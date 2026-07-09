# kithara

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/asano69/kithara)

## Introduction 🫴

kitharaは、生活習慣を整えるためのシンプルなリマインダーアプリ。

定期的に行いたい習慣・家事・行事を、やり逃さないように通知する。

一回限りのイベントに対して通知することはこのアプリのスコープではない。

目的は、好ましい習慣の形成であり、kithara は行動を起こすための機会を作る。

通知アプリはさしあたってはgotifyを想定する。

イベントのスケジュール方法には柔軟性をもたせる。

今日から３日おきに通知、毎週X曜日に通知、毎月N日に通知、13週間おきに通知、毎年X日に通知など。

複雑な定期スケジュールは、条件式の組み合わせ（RFC5545）でほぼ表現できる。

おそらく github.com/teambition/rrule-go が使えるはずだ。

しかし、cel-expr/cel-goという選択肢もある。grule-rule-engine は、この用途には扱いにくいだろう。


## Implementation

Frontend: Solid.js, Tailwind v4
- https://github.com/jkbrzt/rrule


Backend: Go/PocketBase v0.39+


フロントエンドでRRULE式をビルドする。

PocketBaseのcron設定でルールを定期的に評価し、条件を満たしていればwebhookを送るようにする。


## Plan

- CLIで、rrule-goのライブラリの振る舞いを実験するプログラムを書く。
- react-rrule-builder-ts をSolid.JS用に移植する。


### Tech Stack
- Go
- [SolidJS](https://github.com/solidjs/solid)
- [PocketBase](https://github.com/pocketbase/pocketbase)

---

=> https://github.com/teambition/rrule-go  
=> https://github.com/jkbrzt/rrule  
=> https://github.com/dcantatore/react-rrule-builder-ts  
