# FlexibleBlocker

FlexibleBlockerは、指定したWebサイトへのアクセスを設定した時間帯に制限できるChrome拡張機能です。

ドメイン全体だけでなくURLのパス階層を指定できるため、サイト全体をブロックせず、特定のコンテンツだけを対象にできます。

## Chromeウェブストアから導入

通常は、Chromeウェブストアからの導入をおすすめします。

[FlexibleBlockerをChromeウェブストアで開く](https://chromewebstore.google.com/detail/mmocfpgibpnnfhnmlkaboonicflnjkcg?utm_source=item-share-cb)

## 主な機能

- Webサイトごとにブロック時間帯を設定
- ドメイン全体または指定したパス階層以下をブロック
- `22:00`～`06:00` のような日をまたぐ時間帯に対応
- ポップアップから表示中のサイトをすぐに登録
- 設定画面から登録済みルールの確認、時間変更、削除
- ブロック画面から設定画面を開く、または該当ルールを解除

## 使い方

1. ブロックしたいWebサイトをChromeで開きます。
2. ChromeのツールバーからFlexibleBlockerを開きます。
3. ブロックする開始時刻と終了時刻を指定します。
4. 「このサイトをブロック」をクリックします。
5. URLに複数の階層がある場合は、ブロックしたい範囲を選択して登録します。

登録済みのルールは、拡張機能の設定画面から変更または削除できます。

## GitHubからダウンロード

GitHubから拡張機能をダウンロードして、開発者向けの方法で導入することもできます。

1. リポジトリページ [kimura-aruku/FlexibleBlocker](https://github.com/kimura-aruku/FlexibleBlocker) を開きます。
2. 「Code」から「Download ZIP」をクリックし、拡張機能のソースコードをダウンロードします。
3. ダウンロードしたZIPファイルを解凍し、その中のフォルダを任意の場所に保存します。
4. Chromeブラウザを開き、アドレスバーに `chrome://extensions` と入力して拡張機能の管理ページを開きます。
5. ページ右上の「デベロッパーモード」をオンにします。
6. 「パッケージ化されていない拡張機能を読み込む」をクリックし、解凍した拡張機能のフォルダを選択します。
7. インストールが完了すると、ChromeにFlexibleBlockerが追加されます。

GitHubから導入した場合、Chromeウェブストア経由の自動更新は行われません。通常利用ではChromeウェブストア版をおすすめします。

## データとプライバシー

ブロック対象のURLと時間帯は、Chromeのローカルストレージに保存されます。

FlexibleBlockerには、設定データや閲覧情報を外部サーバーへ送信する機能はありません。ブロック判定は利用者のブラウザ内で完結します。

## 使用する権限

| 権限 | 用途 |
|---|---|
| `storage` | ブロック対象と時間帯の保存 |
| `webNavigation` | ページ遷移の検知 |
| `activeTab` | 操作中タブのURL取得と制御 |
| `tabs` | 対象タブの取得とブロック画面への遷移 |
| `<all_urls>` | 任意のWebサイトをブロック対象として判定するため |

## 開発

本プロジェクトは、バニラJavaScript、HTML、CSSで構成されたChrome Extension Manifest V3の拡張機能です。ビルド処理や外部パッケージのインストールは必要ありません。

変更内容を確認する場合は、`chrome://extensions` でFlexibleBlockerを再読み込みしてください。

詳しい仕様と設計は次のドキュメントを参照してください。

- [詳細仕様](docs/specification.md)
- [設計仕様](docs/architecture.md)

## 不具合・要望

不具合や機能要望は、[GitHub Issues](https://github.com/kimura-aruku/FlexibleBlocker/issues) から報告してください。

## ライセンス

本プロジェクトは[MIT License](LICENSE)の下で公開されています。
