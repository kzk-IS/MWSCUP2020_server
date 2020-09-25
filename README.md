# 概要
MADMAXアプリケーション環境でのサーバ側では受け取ったドメインから、学習済みのELMモデルを用いて、悪性ドメインか良性ドメインかを分類しユーザ側にその結果を返す。
具体的には受け取ったドメインから次の文献に示されているような9つの特徴量を取得し、ELMへの入力とする。

Shi et al., “Malicious Domain Name Detection Based on Extreme Machine Learning”, Neural Process Lett 48, 1347–1357, 2018

MADMAXのユーザは、以下のリポジトリに示すFirefox ADD-ONSをインストールするだけで利用することが可能である。

https://github.com/kzk-IS/MWSCUP2020_addon

# アルゴリズム

入力 : ドメイン(例 : osaka-u.ac.jp)

出力 : 予測結果(0 : 良性, 1: 悪性)
1. ドメインから示した文献に準ずる9つの特徴量の取得
2. 取得した特徴量を入力とし，ELMを用いて悪性ドメインまたは良性ドメインを判別
3. 予測結果(0 or 1)をユーザ側へ送信

# 特徴量取得
特徴量は以下の9種類を使用

1. ドメイン名の文字数  
ドメイン名に含まれる全文字数  
例: 13 (osaka-u.ac.jp)
2. 連続文字の最大連続数  
ドメイン名において、連続する文字の最大長  
例:  (aaaabcbbb.jp)
3. ドメイン名のエントロピー  
各文字の出現回数を{*c<sub>1</sub>, c<sub>2</sub>, ... c<sub>n</sub>*}、
ドメイン名の全文字数を*d*としたとき、
その頻度*p<sub>i</sub>=c<sub>i</sub> / d*を用いて、エントロピー*E*は
以下のように表すことができる  
    <img src="https://latex.codecogs.com/gif.latex?\begin{align*}&space;E&space;=&space;-&space;\sum_{i=1}^{n}&space;p_{i}&space;\times&space;\log_{2}p_{i}&space;\end{align*}" />  
例: 3.180832987205441 (osaka-u.ac.jp)
4. ドメインに紐づけられたIPアドレス数  
5種類のDNSサーバ `1.1.1.1`, `8.8.8.8`, `208.67.222.123`, `176.103.130.130`, `64.6.64.6`
に介してドメインに紐づけられたIPアドレスを探し、その種類を数える  
例: 3 (github.com)
5. IPアドレスの所属する国数  
上記IPアドレスが割り振られた国を検索し、その種類を数える  
例: 1 (github.com)
6. Time To Live (TTL) の平均値  
上記DNSサーバへの問い合わせ時に取得したTTL値の平均  
例: 53667 (osaka-u.ac.jp)
7. TTLの標準偏差  
上記DNSサーバへの問い合わせ時に取得したTTL値の標準偏差  
例: 102768.95645475826 (osaka-u.ac.jp)
8. ドメインの有効日数  
whoisサーバに登録されたドメインの情報から、ドメインの作成日から有効期限までの日数を計算する  
例: 2268 (osaka-u.ac.jp)
9. ドメインのアクティブ日数  
whoisサーバに登録されたドメインの情報から、ドメインの作成日から直近の更新日までの日数を計算する  
例: 1904 (osaka-u.ac.jp)

# 学習について

先ほどの特徴量を抽出することにより新たに作成した実データセットを利用して、サーバ内のELMモデルを学習させた。データセットの規模は4000件である（悪性ドメイン：2000件、良性ドメイン：2000件）。

大まかにはDomain Generation Algorithmで生成される様なドメインの構造の学習や、攻撃用に使うため短期間のみ有効となる様なドメインの特徴の学習を行っている。

学習させたELMモデルの性能を測るため交差検証を行った結果、精度は90.1%であった。

※データセットについては倫理的問題のため，公開しておりません．もし研究などで使いたい人がいればご連絡ください．


# 実行環境
- Amazon Linux AMI release 2018.03
- Node.js v12.18.3
- npm 6.14.6

# 環境構築

- https://nodejs.org/ja/download/ からNode.jsのインストール(v12.18.3)
- ターミナルを起動，各バージョン確認
    - `npm -v` 出力結果 6.14.6
    - `node -v`  出力結果 v12.18.3
- server環境を構築したいディレクトリに移動
- `mkdir http_server` ディレクトリ作成
- `cd http_server`
- `npm install @tensorflow/tfjs-node` tensorflow.jsのNode.jsに最適化されたライブラリをinstall

# 製作者
- [kzk-IS](https://github.com/kzk-IS)
- [akazs](https://github.com/akazs)
- [nanana710](https://github.com/nanana710)
- [han9umeda](https://github.com/han9umeda)
- [takemr](https://github.com/takemr)
- [flabrei926](https://github.com/flabrei926)

# アドバイザー
[矢内直人(大阪大学 大学院情報科学研究科 セキュリティ工学講座(藤原研究室) 助教)](http://www-infosec.ist.osaka-u.ac.jp/~yanai/)
