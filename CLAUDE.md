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

- 変更内容を Codex形式(Search/Replace形式)で出力してください。例）
```
mathweb/flask/app.py
<<<<<<< SEARCH
from flask import Flask
=======
import math
from flask import Flask
>>>>>>> REPLACE
```

## Work in Progress
- フロントエンドからpb.jsクライアントを介して、エントリを作成し保存できるようにする
- RRule式を評価して、通知をテストしてみる。
