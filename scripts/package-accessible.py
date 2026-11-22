"""Package verified accessible build, retaining the original distribution."""
from pathlib import Path
import hashlib
import zipfile

root = Path(__file__).resolve().parents[1]
exe = root / 'windows-exe/v0.1.1-final/mdlite-windows-x64/release/mdlite-0.1.1-windows-x64.exe'
expected = 'b3cac72bcef78cf9b0a775720b37463dcc6a7f4cbf733d960c33819bb4e2f016'
assert hashlib.sha256(exe.read_bytes()).hexdigest() == expected
output = root / 'windows-exe/mdlite-0.1.1-windows-x64.zip'
files = [exe, root / 'README.md', root / 'ACCESSIBILITY.md', root / 'THIRD_PARTY_NOTICES.md']
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for source in files:
        archive.write(source, f'mdlite/{source.name}')
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    for source in files:
        assert archive.read(f'mdlite/{source.name}') == source.read_bytes()
data = output.read_bytes()
parts_dir = root / 'windows-exe/telegram-v0.1.1'
parts_dir.mkdir(exist_ok=True)
parts = []
chunk_size = 45 * 1024 * 1024
for index, offset in enumerate(range(0, len(data), chunk_size), 1):
    part = parts_dir / f'{output.name}.{index:03d}'
    part.write_bytes(data[offset:offset + chunk_size])
    parts.append(part)
assert b''.join(part.read_bytes() for part in parts) == data
print(f'ZIP verified: {output}, {len(data)} bytes')
print(f'SHA256: {hashlib.sha256(data).hexdigest()}')
for part in parts:
    print(f'{part}: {part.stat().st_size} bytes')
