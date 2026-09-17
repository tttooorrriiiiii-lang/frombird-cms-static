FROM BIRD ADMIN v2

変更:
- 新規アカウント作成ボタンを削除
- パスワード再設定を追加
- admin権限がないアカウントは管理画面に入れない
- コンテンツ: 編集 / 削除
- 更新情報: 編集 / 削除
- カテゴリ: 編集 / 削除 / 使用停止 / 表示順
- noindex / nofollow

Vercel:
このフォルダを既存の frombird-cms-static プロジェクトへ Production Deploy してください。
デプロイ後は /admin/ を使用します。

※ パスワード再設定メールのリダイレクトには、Supabase Auth の Redirect URLs に
  管理画面のURL（将来は https://admin.frombird.com/admin/ ）を許可する必要があります。
