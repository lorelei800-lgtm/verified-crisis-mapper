# Verified Crisis Mapper

**AI耐性・信頼スコア付きコミュニティ被害報告プラットフォーム**  
Re:Earth（オープンソースWebGIS）上に構築 | 株式会社Eukarya 提出

---

## 提出情報

| 項目 | 詳細 |
|---|---|
| 提出組織 | 株式会社Eukarya（Eukarya Inc.） |
| 本社所在地 | 東京都渋谷区 |
| CEO | 田村賢哉 |
| 基盤プラットフォーム | Re:Earth — オープンソースWebGIS（Apache-2.0） |
| チャレンジ | UNDP / Wazoku InnoCentive：危機マッピングチャレンジ |
| 連絡先 | info@eukarya.io |

---

## 1. エグゼクティブサマリー

株式会社Eukaryaは、**Verified Crisis Mapper** を提案します。これは、当社のプロダクショングレードWebGISプラットフォーム「Re:Earth」上に構築された、オープンソースかつAI耐性を持つコミュニティ被害報告プラットフォームです。Re:EarthはすでにProject PLATEAU（国土交通省、300自治体・約30TBのデータ）[^12]を支えており、実用規模での運用実績があります。

本プラットフォームはUNDPの中核的要件を満たします：危機に直面した住民がモバイルまたはウェブから位置情報付き写真・被害状況を投稿し、データがリアルタイムマップ上に表示されて人道支援の意思決定を支援する仕組みです。

本提案の最大の差別化要素は、内蔵された**Trust Verification Engine（信頼性検証エンジン）**です。各報告に信頼スコア（0〜100点）を自動付与する三層の自動データ品質保証レイヤーにより、AI生成合成メディアが蔓延する現代においても、意思決定者が捏造・誤報ではなく信頼できる現地データに基づいて行動できるようにします。

> **オープンソース宣言：** Re:EarthはApache-2.0ライセンスで公開されており、UNDPのオープンソース要件を完全に満たしています。チャレンジ用の全拡張機能も同ライセンスで公開します。

| 評価軸 | 詳細 |
|---|---|
| プラットフォーム | Re:Earth WebGIS — Apache-2.0 OSS |
| 独自機能 | Trust Score Engine — AI生成検出 + 衛星照合 + H3空間クラスタリング + C2PA（対応デバイスのみ）[^8] |
| 実証済みスケール | PLATEAU：300自治体・30TB[^12] — 同一インフラを危機報告用に展開 |
| 誠実なスコープ | 自然災害・非遮断紛争を対象；ネット遮断シナリオは明示的にスコープ外 |

---

## 2. 問題の定義

### 2.1 危機対応における情報空白

大規模災害後の「クリティカル72時間」[^1]において、人道支援担当者は不完全・遅延・地理的に不正確なデータに基づいて資源配分の意思決定を迫られます。衛星画像はマクロレベルの分析を提供しますが、個々のインフラ被害を把握することはできません。現地の人的報告は不可欠ですが、このデータをリアルタイムで収集・検証・可視化するスケーラブルで低摩擦なシステムは現存していません。

### 2.2 新たな脅威：危機報告における生成AIの悪用

既存の危機報告ツールが対処できていない重大な新興課題として、生成AI時代におけるクラウドソースデータの完全性があります：

- AIによる偽被害画像は広く利用可能なAI画像・動画合成ツールでほぼゼロコストで作成でき、報告システムへの投稿によって支援をある地域に誘導したり、真に被害を受けた地域への支援を妨げたりできます。[^2]
- 組織的な大量投稿キャンペーンにより、政治的・物流的な目的で優先度ランキングが操作される可能性があります。[^3]
- GPS座標の偽装によって緊急資源が誤った場所に誘導される可能性があります。
- 過去の災害から流用された画像（文脈を切り離して）が、活発な危機の最中にSNSで頻繁に拡散します。[^3]

### 2.3 誠実なスコープ定義

本システムが対応できること・できないことを三つの危機通信環境に整理して明示します：

| 危機の種類 | スコープ | 根拠 |
|---|---|---|
| 自然災害（地震・洪水・嵐） | **対象** | 政府のインターネットインフラが維持される。PWA事前インストールおよび災害後のSMS・ラジオによるURL配布が両方可能。主要対象シナリオ。 |
| 紛争・紛争後（政府がネットを遮断しない） | **対象** | 部分的なインフラを通じてインターネット接続が維持される。システムは設計通りに機能する。 |
| 政府によるインターネット完全遮断 | **対象外** | 完全なネット遮断はすべてのウェブベースツールを無効化する。これはソフトウェア設計で解決できる政治的インフラの問題ではない。Direct-to-Cell（D2C）衛星技術をPhase 4+のロードマップで検討する。 |

このスコープの透明性は、当社のエンジニアリング哲学を反映しています：限界を正直に定義したシステムは、過度な約束をするシステムよりも信頼に足ります。

---

## 3. ソリューション：Verified Crisis Mapper

### 3.1 三層アーキテクチャ

| レイヤー | 説明 |
|---|---|
| **Layer 1 — データ収集**（Re:Earth CMS） | 写真・GPSタグ付き位置情報・被害カテゴリ・説明をスマートフォン/ウェブフォームで送信。EXIFメタデータとタイムスタンプを自動取得。最小限の操作で完了——片手操作・3タップでコアフィールド入力完了。PWA Service WorkerとBackground Syncによるオフラインファースト運用をサポート。 |
| **Layer 2 — Trust Verification Engine** ★ 主要差別化要素 | 自動データ品質保証：（1）AI生成フィンガープリント検出 + EXIF GPS/タイムスタンプ整合性 + C2PA暗号化検証[^8]（対応デバイスのみ）による画像整合性検証；（2）衛星被害解析との地理空間整合性照合；（3）H3空間クラスタリング[^9]と外れ値検出による報告相互検証；（4）各報告への信頼スコア（0〜100）自動付与；（5）スコアルーティング：≥80 → マップ表示（緑）；50〜79 → 要注意表示（黄）；<50 → 人的審査キュー（赤）。 |
| **Layer 3 — 可視化・意思決定支援**（React PWA Dashboard） | 政府・UNDP担当者向けのモバイルファーストかつインストール可能なProgressive Web Appダッシュボード。信頼度別カラーコードのリアルタイムマップ（MapLibre GL JS + 衛星画像）、優先エリア自動ランキング、WFP・OCHA・パートナーシステムと互換のGeoJSON/CSVエクスポートを提供。単一PWAで現場報告者とオペレーター双方が利用可能——追加インストール不要。 |

### 3.2 ユーザージャーニー

#### Phase 1 — 発災前：コミュニティの事前準備

![Phase 1 — コミュニティ防災訓練：住民がQRコードをスキャンしてPWAをインストール](images/phase_0.png)

*図1 — 防災訓練中、自治体担当者がQRコードを配布。住民は一度スキャンするだけでPWAをインストール——以降、報告フォームはデバイス上にキャッシュされ、ネット接続なしで即座に起動できる。*

歴史的先例（2010年ハイチ地震SMS「4636」[^6]、2016年熊本地震LINE[^7]）からの重要な設計知見：新しいツールは危機の最中に学ぶことができません。QRコードスキャンによるPWAインストールは平時の防災訓練中に約10秒で完了します。インストール後、報告フォームはデバイス上にキャッシュされ、ネット接続なしでも瞬時に起動します。

#### Phase 2 — 報告ウィンドウ：災害後2〜72時間

![Phase 2 — 住民がスマートフォンでGPS自動タグ付きの被害写真を撮影](images/phase_2.png)

*図2 — 報告ウィンドウ（災害後2〜72時間）において、住民がGPS自動タグ付きで被害写真を撮影。緊急車両がSMSでURLを一斉送信し、事前インストールのない住民にもリーチする。*

三つのアクセス経路：
- **Route A（事前インストール済みPWA）：** ホーム画面アイコンをタップ → カメラ起動 → GPS自動取得 → 3タップでフォーム入力完了 → データをキュー。ネット依存ゼロで入力完了。
- **Route B（初回ブラウザアクセス）：** 緊急対応担当者がSMS・ラジオ・避難所の掲示でURLを配布。接続回復後の住民がブラウザ経由でフォームにアクセス。
- **Route C（WhatsApp Business APIボット）：** アプリをインストールせず、ブラウザリンクも持たない住民向けに、WhatsAppボットが馴染みのあるチャット形式で写真 + 位置情報 + 被害説明を受け付け。ボットは投稿をRoute A/Bと同一のCMSスキーマに正規化——三経路すべてが同じTrust Scoreパイプラインとマップに集約される。

オフライン耐性：Background Sync APIがローカルに投稿をキュー；接続回復時に自動送信——ユーザー操作不要。

#### Phase 3 — 指揮・意思決定：リアルタイム状況把握

![Phase 3 — 政府・UNDP担当者がVerified Crisis Mapperダッシュボードを参照](images/phase_3.png)

*図3 — 合同指揮センターにて、政府・UNDP担当者がVerified Crisis Mapperダッシュボードを参照。信頼度別カラーコードのピン（緑/黄/赤）と衛星画像が資源配備の意思決定を支援。現場報告者が使うPWAと同一のコードベースが、オペレーター用ダッシュボードにも対応——単一アプリで全ユーザーをカバー。*

### 3.3 Trust Score Engine — 技術設計

| 要素 | 配点 | 手法 |
|---|---|---|
| 画像整合性 | 40点 | 主：全投稿に対するAI生成フィンガープリント検出（周波数領域解析）；EXIF GPS/タイムスタンプ整合性チェック；投稿デバイスが対応している場合はC2PA（Content Credentials）[^8]暗号化検証を高信頼ボーナスとして適用。注：危機影響地域でのC2PAハードウェア対応は限定的；スコアリングモデルはC2PA不要で機能するよう設計。 |
| 地理空間整合性 | 30点 | 報告座標を衛星由来の被害確率マップと照合；歴史的ベースラインとの比較 |
| 報告相互検証 | 20点 | H3空間グリッドクラスタリング[^9]（Resolution 9、約0.105km²セル）；近隣報告との特性比較による外れ値検出；報告初期の疎なフェーズではニュートラルスコアに緩和 |
| 投稿メタデータ | 10点 | デバイスタイムスタンプの妥当性；GPS精度半径；投稿チャネル信頼度重み付け |
| スコアルーティング | — | 80〜100：高信頼 → マップ表示（緑）\| 50〜79：要確認 → 要注意表示（黄）\| 0〜49：要検証 → 人的審査キュー（赤） |

> **政治的中立性の注記：** Trust Score Engineは物理的・地理的データの整合性を対象とします——報告された建物崩壊が実在し、正しく位置づけられているかを検証します。政治的言論・意見・ユーザーの身元は評価しません。これにより、本システムは政治的に中立を保ち、人道的目的に集中します。

> **設計の誠実性の注記：** 画像整合性要素はすべての投稿にAI生成検出とEXIF解析を適用します。C2PA暗号化検証は存在する場合に高信頼シグナルとして機能しますが、本システムはC2PAを必須としない設計を明示しています——ローエンドデバイスおよびメタデータが転送中に除去されるWhatsApp Route Cからの報告を平等に扱うためです。

---

## 4. 技術仕様・オープンソース準拠

### 4.1 技術スタック

| コンポーネント | 技術 |
|---|---|
| フロントエンド / 可視化 | React PWA + MapLibre GL JS — モバイルファースト・インストール可能・Apache-2.0 OSS |
| バックエンド / CMS | Re:Earth CMS — Go、Rust；REST/GraphQL API付きヘッドレスCMS |
| プラグインシステム | WebAssemblyベースのサンドボックス化プラグインランタイム |
| オフライン / PWA | Service Worker + Background Sync API；IndexedDBローカルストレージ |
| 画像検証 | C2PA オープン標準（Coalition for Content Provenance and Authenticity）[^8] |
| 空間インデックス | Uber H3ヘキサゴナルグリッド[^9]（Resolution 9）による報告間クラスタリング |
| データエクスポート | GeoJSON、CSV — HDX・OCHA IM Toolbox・KoboToolbox互換 |
| ホスティング | クラウド非依存；Docker コンテナ化；政府自前デプロイ対応 |

### 4.2 オープンソース要件

- **ライセンス：** Apache-2.0（商用利用・改変・再配布すべて許可）
- **リポジトリ：** github.com/reearth — チャレンジ固有の全拡張機能も同ライセンスで公開

### 4.3 プライバシー・セキュリティ設計

- 報告者の連絡先情報は任意かつ保存時に暗号化
- 生体情報の収集なし；行動プロファイリングなし
- Trust Scoreの計算は完全に透明かつ監査可能——オープンソースアルゴリズム
- GDPR準拠のデータ取り扱い；デプロイ単位でデータ保持ポリシーを設定可能
- 役割ベースアクセス制御：報告者は自分の投稿確認のみ；政府/UNDP担当者は集計ダッシュボードにアクセス

---

## 5. 株式会社Eukarya — 実績・信頼性

株式会社Eukaryaは、東京大学渡辺研究室発のGeospatial Technology Companyです。ミッション：地理空間データをデジタル公共財として万人に開く。

| パートナー / プロジェクト | 説明 | 関連性 |
|---|---|---|
| Project PLATEAU（国土交通省）[^12] | 国家3D都市モデルプラットフォーム — 300自治体・約30TB。Re:Earthが可視化とCMSの基盤を担う。 | 防災・都市インフラ |
| UNDP / OCHA互換性 | Re:EarthのデータエクスポートはGeoJSON/CSV形式でKoboToolbox・HDX・OCHA IM Toolboxと直接互換。 | 人道支援データ相互運用性 |
| FOSS4G（グローバルOSS GIS学会）[^15] | 世界最大のオープンソースGIS国際学会への定期登壇。 | OSS信頼性・国際ネットワーク |

---

## 6. 実施計画

| フェーズ | 期間 | タイトル | 成果物 |
|---|---|---|---|
| Phase 1 | 0〜3ヶ月 | コアプラットフォームMVP | Re:Earth CMSスキーマ、PWAフォーム、基本マップ可視化、Trust Score MVP |
| Phase 2 | 3〜6ヶ月 | 検証エンジン | C2PAモジュール、衛星API連携、地理空間整合性エンジン、完全ダッシュボードUI |
| Phase 3 | 6〜12ヶ月 | フィールドテスト | UNDPターゲット地域でのパイロット展開、多言語UI（アラビア語・フランス語・スペイン語・スワヒリ語）、オフライン最適化 |
| Phase 4 | 12ヶ月〜 | スケール・将来技術 | 多地域展開、OCHA/WFP API連携、D2C衛星接続の探索 |

### 6.1 提出時のプロトタイプ状況

提出時点で、以下のコンポーネントがライブURLにて動作・確認可能です：

**ライブデモ：** https://lorelei800-lgtm.github.io/verified-crisis-mapper/demo/
*（デプロイメント：東京洪水対応、神田川流域 — 千代田区・神田エリア）*

- **報告PWA：** 写真アップロード・GPS自動取得（Nominatim逆ジオコーディングによるランドマーク・地区名自動入力）・被害分類（軽微 / 部分的破損 / 全壊）・インフラカテゴリ8種・送信直後のリアルタイムTrust Score表示を備えたモバイルファーストの被害報告フォーム。GPS不使用でも動作（段階的な劣化とユーザーガイダンスを提供）。オフラインファースト：投稿はIndexedDBにキューされ、Background Sync経由で接続回復時に自動同期。
- **マップベースのロケーションピッカー：** フルスクリーン衛星マップオーバーレイ（フローティングピン方式）によるモバイルでの位置選択——固定されたCSSセンターピンの下でマップをパンし、`map.getCenter()`で確認。Android ChromeのタップDetectionの信頼性問題を解消。メインバンドルを約62KB gzipに保つレイジーローディング実装。
- **オペレーターダッシュボード：** カラーコードの報告ピン（緑≥80 / 黄50〜79 / 赤<50）を表示するReact + MapLibre GL JS衛星マップ、ズーム適応型マーカークラスタリング（ズーム≥12で個別ピン；低ズームでクラスターカウントバッジ）、信頼度・インフラ種別フィルタリング、最新順/Trust Scoreソート、報告ごとのTrust Scoreブレークダウン。市民はビューアーPINゲートなしでダッシュボードに無料アクセス可能。
- **スタッフログインボタン：** 「政府 / 自治体職員ログイン」リンクをダッシュボード内（デスクトップ：サイドバー下部；モバイル：統計オーバーレイ下部）に配置——ロゴ秘密タップなしで管理PINスクリーンに直接遷移。
- **Admin Review Panel：** プログレッシブロックアウト付きPIN認証（3回失敗 → 30秒ロック；6回以上 → 120秒ロック）の政府オペレーター向けビュー。三ボタンレビューワークフロー：**承認** / **↩ 保留に戻す** / **拒否** ——保留ボタンにより審査担当者が決定を取り消して再検討可能。拒否時は6択の理由ドロップダウンあり。全決定はRe:Earth CMSに書き戻され、30秒以内に接続済みの全ダッシュボードに反映。
- **クロスデバイスリアルタイム同期：** 審査決定と新規投稿がCMSポーリング経由で30秒以内に全接続デバイスに反映。
- **Trust Score MVP：** 完全なスコアリングパイプラインをデモ——画像整合性・地理空間整合性・報告相互検証・投稿メタデータの4要素。スコアブレークダウンは報告者確認画面とAdmin詳細カードの両方で棒グラフ表示。
- **Re:Earth CMS：** シングルデプロイメントモデル——デプロイメントコンテキスト（都市/地域）ごとに1CMSプロジェクト。`deployment-config`モデル（境界・エリア・admin_pin・ラベル）と`damage-reports`モデル（信頼スコアサブスコア・review_status・reject_reason・画像アセットを含む15フィールド）。マルチデバイス・マルチオペレーター展開に対応したプロダクション対応バックエンド。

> **TRLステータス：** 提出時TRL 4〜5。コアデータ収集・検証パイプライン・マルチデバイスオペレーターワークフローは動作済み。完全なTrust Scoreエンジン（C2PAライブ検証・衛星API連携）はショートリスト選出後のPhase 2で実装予定。

---

## 7. 期待されるインパクト

### 7.1 直接的な人道支援インパクト

- 危機初動対応における情報空白を数日から数時間に短縮[^1]
- 意思決定者に信頼較正済みデータを提供——被害が報告された場所だけでなく、各報告への信頼度も把握可能
- 限られた人道支援資源を誤誘導しうるAI生成偽情報[^2]への対抗
- WFP・OCHA・他のUNDPパートナーシステムとの直接統合のためのGeoJSON/CSVデータエクスポートの実現

### 7.2 長期的な構造的インパクト

- オープンソース公開により、人道支援機関・政府・NGOがゼロライセンスコストで展開可能
- Trust Score Engineは危機報告を超えた応用が可能：選挙監視・環境被害報告・紛争ドキュメンテーション
- AI耐性を持つ人道支援データ収集を軸とした実践コミュニティの確立
- UNDP連携によりVerified Crisis MapperをコミュニティパワードDとなる危機データ完全性のグローバルスタンダードとして位置づけ

### 7.3 UNDPの戦略的優先事項との整合

- **情報の完全性：** UNDPの幅広い誤情報・偽情報対策マンデートを直接支援
- **SDG 11**（住み続けられるまちづくり）および**SDG 17**（パートナーシップ）[^16]：政府が自前で所有・運用できるオープンインフラ

---

## 参考文献

[^1]: UN Office for the Coordination of Humanitarian Affairs (OCHA). (2013). *Humanitarianism in the Network Age*. New York: United Nations. 「クリティカル72時間」の枠組みは以下にも登場：Inter-Agency Standing Committee (IASC). (2012). *Reference Module for Cluster Coordination at the Country Level*. Geneva: IASC；International Federation of Red Cross and Red Crescent Societies (IFRC). (2013). *World Disasters Report 2013: Focus on Technology and the Future of Humanitarian Action*. Geneva: IFRC.

[^2]: Chesney, R. & Citron, D.K. (2019). "Deep Fakes: A Looming Challenge for Privacy, Democracy, and National Security." *California Law Review*, 107(6), 1753–1820. See also: Vaccari, C. & Chadwick, A. (2020). "Deepfakes and Disinformation: Exploring the Impact of Synthetic Political Video on Deception, Uncertainty, and Trust in News." *Social Media + Society*, 6(1), 1–13. https://doi.org/10.1177/2056305120903408

[^3]: Wardle, C. & Derakhshan, H. (2017). *Information Disorder: Toward an Interdisciplinary Framework for Research and Policy Making*. Council of Europe Report DGI(2017)09. Strasbourg: Council of Europe.

[^6]: Heinzelman, J. & Waters, C. (2010). *Crowdsourcing Crisis Information in Disaster-Affected Haiti*. Special Report 252. Washington, D.C.: United States Institute of Peace. See also: Meier, P. (2012). "Crisis Mapping in Action: How Open Source Software and Global Volunteer Networks Are Changing the World, One Map at a Time." *Journal of Map & Geography Libraries*, 8(2), 89–100.

[^7]: 内閣府. (2016). 「平成28年熊本地震に係る緊急対応」. 東京：内閣府. 広範な文脈については：Reuter, C., Hughes, A.L., & Kaufhold, M-A. (2018). "Social Media in Crisis Management: An Evaluation and Analysis of Crisis Informatics Research." *International Journal of Human–Computer Interaction*, 34(4), 280–294. https://doi.org/10.1080/10447318.2018.1427832

[^8]: Coalition for Content Provenance and Authenticity (C2PA). (2023). *C2PA Technical Specification v1.3*. https://c2pa.org/specifications/ C2PAは、Adobe・Microsoft・BBC・Intelなどが参加するコンソーシアムで、デジタルメディアファイルに添付される暗号化署名済みの出所メタデータのオープン標準を策定している。

[^9]: Brodsky, I. (2018). "H3: Uber's Hexagonal Hierarchical Spatial Index." *Uber Engineering Blog*, 27 June 2018. https://www.uber.com/blog/h3/ H3 Resolution 9の平均ヘキサゴン面積は0.1053 km²、平均辺長は約174 m。

[^12]: 国土交通省. *Project PLATEAU：3D都市モデルイニシアチブ*. https://www.mlit.go.jp/plateau/

[^15]: Open Source Geospatial Foundation (OSGeo). *FOSS4G — Free and Open Source Software for Geospatial*. https://www.osgeo.org/initiatives/foss4g/ FOSS4Gは2004年から年1回開催されており、OSGeo財団の旗艦国際会議である。

[^16]: United Nations. (2015). *Transforming Our World: The 2030 Agenda for Sustainable Development*. Resolution A/RES/70/1. New York: United Nations.

---

*株式会社Eukarya | info@eukarya.io | github.com/reearth | reearth.io*  
*Re:Earth — Opening Up Data for All | Apache-2.0 Open Source*
