# AGENTS.md

ひかり道：左の明かりから出る光を鏡で曲げ、部屋の宝石を全部通して出口へ届ける1日3問のパズル（いちばん少ない鏡の数を目指す）。`index.html` と `gen.js`（部屋の作り方と、いちばん少ない鏡の数の数え方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # 部屋の作り方（4つの大きさ×何百部屋、いちばん少ない鏡の数を別に書いた光のたどり方と全部の置き方で数え直す）・3問の組み方（1年分）・置く/回す/戻す・ヒント・続きから・上級・部屋帳・実績・スマホ幅・PWA（CI の QA と同じ）
```

## このリポジトリの決まり

- 光のきまり：左の明かりから右へ進む。鏡「／」「＼」に当たると直角に曲がり、鏡は表と裏の両方で曲げる（同じ鏡に2回当たってもよい）。岩で止まり、宝石は通りぬける。宝石を全部通って出口から出たら届いた。遊び方と README に同じことを書く。
- 部屋は `gen.js` の `make` が種から作る：先に光の道（曲がり角に鏡）を作り、道の上に宝石、道の外に岩を置き、曲がり角のいくつかははじめからの鏡にする。いちばん少ない鏡の数 `d` は `solve` が数え直す（鏡を置くか置かないかを光の通る順に決め、ゆるめた数え方の下限で枝を刈る。下限は「1枚の鏡は2回まで使える」ので曲がる回数の半分）。`d` は画面に出す。`gen.js` を変えると過去の日の部屋も変わるので、変えた PR に一言書く。
- 今日の3問（小部屋5×5・広間6×6・大広間6×7）・上級（6×8を2つ）は日本時間の日付から作る種（`seedOf`）で決まり、だれでも同じ。`Math.random()` は練習の部屋の種だけ（QA が数を見る）。
- ★は鏡の数で決める（いちばん少ない数で★3・2枚多いまで★2・それ以上★1）。ヒント（いちばん少ない置き方の鏡を光の通る順に1枚置いて動かせなくする。合っていれば余分な鏡を1枚はずす）1回ごとに★を1つ減らす（最低★1、2回まで）。上級はヒントなし。時間制限は付けない。
- 今日の3問・上級は1日1回で、途中で閉じても置いた鏡とヒントのまま続きから。保存してあった置き方は、空いたますだけ・鏡の値・形・ヒントのますに鏡があるかを確かめてから使う（`valid`）。途中経過はモードごとに分けて保存し（`runs.d`・`runs.h`・`runs.p`）、練習で今日・上級の途中を消さない。答えを入れる前に、保存した進み具合が画面と同じ問題か確かめる。同じ回数で古いタブが保存しても上書きしない（ヒントの鏡と数を残す）。同じだけ進んだ記録を読み合わせるときもヒントの数は多いほう。記録は保存の前に読み直す。保存に失敗したあとは、途中経過を時刻でなく進み具合で選び、部屋帳の数は多いほうを残す（shared-workflows `incidents/2026-11-04-daily-game-save-gaps.md`）。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に部屋の形・答えを出さない（🟩いちばん少ない鏡・🟨2枚多いまで・🟧もっと・💡ヒント）。
- 文字は少なめ・一画面一問。お笑いの言葉は入れない（QA が見る）。ほかの作品の名前・キャラ・見た目は使わない。
- 実績（`achList`）は腕前と集めることに報い、まだのものは進み具合を出す。ぴったり・ヒントなし・上級は今日の3問と上級の記録だけで数え、練習は部屋帳の数にだけ入る。新しく取った実績は次の結果の画面で知らせる（`s.ach`）。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、ラベル「感想」、フォーム名は4字以上）を開くだけ。項目は shared-workflows の `template/.github/ISSUE_TEMPLATE/feedback.yml` と同じにし、名前・メールは聞かない。週1で shared-workflows `routines/game-feedback.md` が読んで直す。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の3問・上級を初めて終えて全部いちばん少ない鏡（ヒントなし）のときだけ、結果の画面の下に1行（共有フォルダ kofi/app-guide.md）。遊ぶのは無料のまま、有料版は置かない。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- 同じ日はどの端末でも同じ問題にする：乱数は `sort` の比較の中で引かない（QA が見る）。少し遅れて動く処理（setTimeout）は、画面が替わっていたら何もしない。
- 押せる所は高さ44px以上、盤のますは幅320pxの上級（6列）でも40px以上（横は6列まで。QA が見る）。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何百回も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- 引き継ぎコード `transfer.js`・`qa/transfer-check.mjs`、見やすさの設定（`<!-- a11y:begin -->`〜`<!-- a11y:end -->`）・`qa/a11y.mjs` は shared-workflows template の写し（ここでは直さず、ひな形を直して写し直す。版は `引き継ぎの版:` と `a11y:begin` の行）。問題文・残りの数には `data-a11y-say`、知らせは `role="status"`／`aria-live`。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の問題を入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
