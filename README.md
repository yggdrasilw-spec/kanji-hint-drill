# ひとふでヒント

東京書籍「新編 新しい国語」に合わせた、漢字を思い出して書くドリルです。学年をリストから選び、単元のチェックボックスで出題範囲を指定します。

## 起動

```
node scripts/serve.mjs
```

http://127.0.0.1:8897/ を開きます。`file://`ではモデル・教材データを読み込めません。静的なHTTPサーバーでも動作します。今回の実装はローカルで確認しており、公開サイトへのデプロイは行っていません。

## 機能

- 1〜6年生の1,026字。単元を個別選択、全部選択、指定単元までの一括選択。
- 読みと□入りの語を提示し、1字を手書き。語彙内の漢字は選んだ範囲と前学年までに限定。
- 複数の語彙・読み方で出題。教科書でその読み方を習う単元は未転記のため、**字の出題範囲が教科書対応、読みは辞書に基づく**。教科書の例文は複製していません。
- 1画目、次の画、答えの順にヒント。ヒント・答えは認識画像に入れません。
- DaKanji v2 ONNXによる文字認識。KanjiVGによる画数・方向・書き順・位置の補助分析。
- 自動判定が曖昧な場合やモデルが使えない場合は、お手本との比較を促し、自己確認として保存します。自己確認は自力での正解・習得に数えません。
- ヒント正解、誤答、答えを見た問題はセッション内で3問程度あけて再出題（追加は最大4問）。誤答は即復習対象、ヒント正解は10分後、自力の正解は1・3・7・14日後。書き順などに課題がある正解は補助ありとして復習対象に残します。
- localStorageで語彙・読みごとに保存。復習日時、誤認識候補、誤答分析、ヒント利用履歴を保持。JSON書き出し・読み込みに対応。読込は最新記録を優先して統合。

現時点の確認はKanjiVGの線を入力する自動検証が中心です。実際の児童の筆跡で認識率を測定したものではありません。部首の欠落や意味の理解を診断する機能はありません。筆順の位置判定は字枠上の座標を比較するため、字の配置によって補助確認が出る場合があります。

## データとライセンス

教材対応はユーザー提供の令和8年度の教科書画像から転記した単元・ページ・漢字。学習する月は記録していません。年度・版の表記はアプリ画面に出していません。教材対応表の公開利用条件は未確認です。

`data/curriculum.json`には単元対応、筆順パス、辞書から抽出した読み・語彙例を収録します。`data/provenance.json`に取得元と処理を記録しています。

- 筆順パス：KanjiVG、Ulrich Apel、CC BY-SA 3.0。既存の`kakijun/svg`から抽出したデータ。派生した筆順データも同条件で扱います。[公式サイト](https://kanjivg.tagaini.net/) / [ライセンス](https://creativecommons.org/licenses/by-sa/3.0/)
- 語彙・読み：EDRDG JMdict / KANJIDIC2、CC BY-SA 4.0。抽出・適応した辞書データも同条件で扱います。[利用条件](https://www.edrdg.org/edrdg/licence.html)
- 認識モデル：Dariyooo (DaAppLab)、DaKanji Single Character Recognition v2.0、MIT。Character recognition powered by machine learning from Dariyooo (DaAppLab)。[モデルの配布元](https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/tag/v2.0)。原文ライセンスは`assets/DAKANJI-LICENSE.txt`。
- ONNX Runtime Web 1.22.0、Microsoft、MIT。原文ライセンスは`assets/ONNXRUNTIME-LICENSE.txt`。

推論はブラウザ内です。筆跡をサーバーに送信しません。初回はローカルサーバーからライブラリ・モデルを取得します。見た目のフォントのみGoogle Fontsを参照し、利用できない場合は端末のフォントに切り替わります。

## 再生成と検証

`scripts/download-assets.mjs`でモデル・辞書・実行ライブラリをダウンロードします。モデルとラベルのZIPを`source/model`、`source/labels`に展開し、`scripts/build-data.mjs`を実行するとデータを再生成します。2〜6年の転記元は現在`C:/Users/user/.cache/kanji-curriculum`、1年の対応はスクリプト内です。パスは別端末で変更が必要です。辞書原本・ZIP・QAスクリーンショットは`.gitignore`で除外しています。

```
node tests/core.test.mjs
node tests/browser.cjs
```

ブラウザ検証はこの端末のPlaywrightとEdgeを使用します。モデルの明暗条件の検証は`tests/model.cjs`です。
