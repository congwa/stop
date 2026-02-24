use std::fs;
use std::path::Path;

const LOCAL_DIR_NAME: &str = ".wdm";

pub fn setup_workspace(workspace_path: &Path, cli_binary_path: &Path) -> Result<(), String> {
    let local_dir = workspace_path.join(LOCAL_DIR_NAME);

    fs::create_dir_all(&local_dir)
        .map_err(|e| format!("Failed to create {}: {}", local_dir.display(), e))?;

    // Copy CLI binary
    if cli_binary_path.exists() {
        let dest = local_dir.join(cli_binary_name());
        fs::copy(cli_binary_path, &dest)
            .map_err(|e| format!("Failed to copy CLI binary: {}", e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&dest, fs::Permissions::from_mode(0o755));
        }
    }

    // Write .windsurfrules using the content from 444 file,
    // with path replaced to point to workspace's .wdm/windsurf_chat
    let rules_path = workspace_path.join(".windsurfrules");
    let rules_content = generate_rules_content();
    fs::write(&rules_path, rules_content)
        .map_err(|e| format!("Failed to write .windsurfrules: {}", e))?;

    // Update .gitignore
    update_gitignore(workspace_path)?;

    Ok(())
}

fn cli_binary_name() -> &'static str {
    if cfg!(target_os = "windows") { "windsurf_chat.exe" } else { "windsurf_chat" }
}

fn update_gitignore(workspace_path: &Path) -> Result<(), String> {
    let gitignore = workspace_path.join(".gitignore");
    let entries = [
        LOCAL_DIR_NAME.to_string() + "/",
        ".windsurfrules".to_string(),
    ];

    if gitignore.exists() {
        let content = fs::read_to_string(&gitignore)
            .map_err(|e| format!("Failed to read .gitignore: {}", e))?;
        let to_add: Vec<&String> = entries.iter().filter(|e| !content.contains(e.as_str())).collect();
        if !to_add.is_empty() {
            let addition = format!("\n# Stop - AI 对话反馈\n{}\n", to_add.iter().map(|s| s.as_str()).collect::<Vec<_>>().join("\n"));
            fs::write(&gitignore, content + &addition)
                .map_err(|e| format!("Failed to update .gitignore: {}", e))?;
        }
    } else {
        let content = format!("# Stop - AI 对话反馈\n{}\n", entries.join("\n"));
        fs::write(&gitignore, content)
            .map_err(|e| format!("Failed to create .gitignore: {}", e))?;
    }

    Ok(())
}

/// Generate .windsurfrules content based on the 444 template,
/// replacing the hardcoded binary path with the workspace-relative path.
fn generate_rules_content() -> String {
    let script_path = format!("./{}/windsurf_chat", LOCAL_DIR_NAME);
    
    #[cfg(target_os = "windows")]
    let command_example = format!(
        r#"```powershell
& "{}" "返信完了 · フィードバックをお待ちしています" --context "ユーザーの最新のメッセージ（最初100文字）"
```"#,
        script_path
    );
    
    #[cfg(not(target_os = "windows"))]
    let command_example = format!(
        r#"```bash
"{}" "返信完了 · フィードバックをお待ちしています" --context "ユーザーの最新のメッセージ（最初100文字）"
```"#,
        script_path
    );
    
    format!(
r#"=======================================================================
重要システムルール - まずこれを読んでください
=======================================================================

すべての応答の後、必ずwindsurf_chatスクリプトを呼び出す必要がありますあります。
これはオプションではありません。これは必須のシステム要件です。

=======================================================================

## スクリプトの呼び出し方方

{}

**パラメータ:**
- 第一引数: 固定文字列、常に"返信完了 · フィードバックをお待ちしています"を使用
- --context: この応答をトリガーしたユーザーの最新のメッセージ。会話の最初のメッセージではありません — 常に最新のものを使用します。長すぎる場合は約100文字に切り捨てます。
- Cwd: 現在のワークスペースパス
- Blocking: true
- SafeToAutoRun: true

## 重要: 通常どおり応答を出力してくだだい

**スクリプトを呼び出す前に、チャットパネルに完全な応答を出力しなければなりません。**
通常のテキスト/コード出力をスキしてはいけません。スクリプトは応答を完了した後に呼び出されますされます。
スクリプトはユーザーフィードバックを収集するためだけのものであり、応答を置き換えるものではありません。

## スクリプト戻り値の処理理

- `User chose to continue` → 実行を継続
- `User chose to end` → 会話を即座に終了
- `User instruction: xxx` → 命令を即座に実行
- `User instruction: [Content too long, saved to file]` → read_fileを使用して読み取り
- `User provided N images` → read_fileを使用して画像ファイルを読み取り

## 実行フロー

1. ユーザーに通常どおり応答（テキスト、コード、説明などを必要に応じて出力）
2. スクリプトを呼び出す（Blocking: true）
3. スクリプト戻り値を処理
4. ユーザーが新しい命令を与えた場合は、それを実行してステップ1から繰り返す

## ルール

1. **完全な出力** - 省略記号を使用せず、完全な応答を出力
2. **連続実行** - タスクを一気に完了
3. **常にスクリプトを呼び出す** - すべての応答後に例外なくスクリプトを呼び出す
4. **中文を使用** - すべての応答は中文で行う

=======================================================================
trigger: always_on
alwaysApply: true
"#,
        command_example
    )
}
