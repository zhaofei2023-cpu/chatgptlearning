#!/usr/bin/env bash
set -euo pipefail
website_root="$(cd "$(dirname "$0")/.." && pwd)"
repository_root="$(git -C "$website_root" rev-parse --show-toplevel)"
remote="$(git -C "$repository_root" remote get-url origin)"
case "$remote" in
  https://github.com/zhaofei2023-cpu/chatgptlearning.git|git@github.com:zhaofei2023-cpu/chatgptlearning.git) ;;
  *) echo '目标仓库与预期不一致，请先人工核对脚本。' >&2; exit 1;;
esac
cd "$website_root"
npm run build
touch dist/.nojekyll
publish_dir="$(mktemp -d /tmp/flowspark-publish.XXXXXX)"
trap 'rm -rf "$publish_dir"' EXIT
git init -q --initial-branch=gh-pages "$publish_dir"
git -C "$publish_dir" remote add origin "$remote"
branch_ref="$(git -C "$publish_dir" ls-remote --heads origin refs/heads/gh-pages)"
if [[ -n "$branch_ref" ]]; then
  git -C "$publish_dir" fetch -q --depth=1 origin gh-pages
  git -C "$publish_dir" checkout -q -B gh-pages FETCH_HEAD
fi
# 仅清理这个脚本创建的临时发布目录，绝不清理源仓库。
python - "$publish_dir" <<'PY'
import pathlib, shutil, sys
root=pathlib.Path(sys.argv[1])
for p in root.iterdir():
 if p.name=='.git':continue
 if p.is_dir():shutil.rmtree(p)
 else:p.unlink()
PY
cp -R dist/. "$publish_dir/"
git -C "$publish_dir" add -A
if git -C "$publish_dir" diff --cached --quiet; then
 echo '静态产物没有变化。'; exit 0
fi
git -C "$publish_dir" -c user.name='FlowSpark Publisher' -c user.email='codex@users.noreply.github.com' commit -q -m 'Publish FlowSpark learning website'
git -C "$publish_dir" push origin HEAD:refs/heads/gh-pages
echo '静态产物已推送。已启用的GitHub Pages会自动部署；首次使用才需选择gh-pages / (root)。'
