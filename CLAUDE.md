# waigaya-relay 開発ガイド（Claude Code向け）

## 開発フロー

### 必須ルール

1. **Issueを必ず先に作成する**
   - 機能追加・バグ修正・リファクタリングを問わず、作業前にIssueを作成すること
   - Issue番号を作業ブランチ名に含めること（例: `feature/123-add-slack-relay`）

2. **PRは必ずIssueと紐づける**
   - PR本文の「関連Issue」欄に `Closes #番号` を必ず記載すること
   - Issue紐付けがないPRはCIで自動的にブロックされる

3. **実行計画をPR本文に必ず記載する**
   - PR本文の `## 実行計画` セクションに、実装方針・手順を具体的に記載すること
   - これはGitHub Actionにより自動的に紐づいたIssueへコメントとして転記される

### PRを作成するときの手順

1. 対象のIssue番号を確認する
2. 実装計画を立て、以下のテンプレートに従ってPR本文を記述する
3. `Closes #番号` でIssueを紐づける

```markdown
## 概要
（何をするPRか）

## 関連Issue
Closes #番号

## 実行計画
（ここに実装方針・手順を具体的に記載する。GitHub Actionによって自動的にIssueへコメントされる）

## 変更内容
- （主な変更点）

## 確認事項
- [ ] テストが通ることを確認した
```

## 技術スタック

- **フレームワーク:** Next.js (App Router)
- **言語:** TypeScript
- **テスト:** Vitest
- **主な依存:** `app/`, `lib/`, `tests/`

## テスト実行

```bash
npm test
```
