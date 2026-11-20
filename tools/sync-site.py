"""Run from any directory: python3 deploy/tools/sync-site.py.
Copy source trees without replacing deployment functions or configuration.
"""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[2]
deploy = root / 'deploy'
for source_name, destination in [('site', deploy), ('studio', deploy / 'studio')]:
    source = root / source_name
    for path in sorted(source.rglob('*')):
        if not path.is_file() or '__pycache__' in path.parts or path.name == '.DS_Store':
            continue
        relative = path.relative_to(source)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix == '.html':
            text = path.read_text()
            if source_name == 'site':
                # Replace the deeper path first to avoid changing its suffix twice.
                text = text.replace('../../studio/', '__DEPLOY_STUDIO_SUB__/')
                text = text.replace('../studio/', './studio/')
                text = text.replace('__DEPLOY_STUDIO_SUB__/', '../studio/')
            else:
                text = text.replace('../site/', '../')
            target.write_text(text)
        else:
            shutil.copyfile(path, target)
print('Synced site/ and studio/ into deploy/.')
