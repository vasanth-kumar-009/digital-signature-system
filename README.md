# Digital Signature System

A digital signature application for generating cryptographic keys, signing files, verifying file integrity, demonstrating tamper detection, and comparing RSA and ECDSA performance.

The repository includes two independent implementations:

- **Web edition:** a responsive HTML, CSS, and JavaScript application powered by the browser's Web Crypto API.
- **Desktop edition:** a Python application with a Tkinter interface and the `cryptography` library.

The web edition runs without a Python backend, database, API key, or JavaScript build step. The desktop edition runs locally as a separate application.

[Repository](https://github.com/vasanth-kumar-009/digital-signature-system) · [Report an issue](https://github.com/vasanth-kumar-009/digital-signature-system/issues)

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Run the web edition](#run-the-web-edition)
- [Run the desktop edition](#run-the-desktop-edition)
- [Usage guide](#usage-guide)
- [How signing and verification work](#how-signing-and-verification-work)
- [File formats and compatibility](#file-formats-and-compatibility)
- [Performance comparison](#performance-comparison)
- [Python module usage](#python-module-usage)
- [GitHub Pages deployment](#github-pages-deployment)
- [Security and current limitations](#security-and-current-limitations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Features

| Capability | Web edition | Desktop edition |
| --- | --- | --- |
| RSA key generation | 1024, 2048, or 4096 bits | 1024, 2048, or 4096 bits |
| ECDSA key generation | P-256 | SECP256R1, the same curve as P-256 |
| Optional private-key password | Encrypted PKCS#8 PEM; minimum 8 characters | Encrypted PKCS#8 PEM through `BestAvailableEncryption` |
| File signing | One selected file at a time | One selected file through the GUI |
| Signature output | Downloadable `.sig` JSON | `.sig` JSON saved in `signed_files/` |
| Verification | Original file, signature file, and public key | Original file, signature file, and public key |
| Tamper demonstration | Modifies an in-memory copy | Creates and removes a temporary `.tampered` file |
| Algorithm comparison | Average of 1, 3, or 5 iterations | One measurement per operation |
| Audit history | Session log with JSON export and clear controls | Persistent JSON log with refresh control |
| Key input | Upload PEM or paste PEM text | Select PEM files from disk |
| Interface | Dark theme, collapsible sidebar, mobile drawer, bottom navigation, drag and drop | Five-tab Tkinter desktop interface |

The Python signing module also exposes `sign_multiple_files()` for programmatic batch signing. Batch selection is not exposed in either graphical interface.

## Technology stack

| Component | Technologies |
| --- | --- |
| Web interface | HTML5, CSS3, vanilla JavaScript |
| Browser cryptography | Web Crypto API: RSA-PSS, ECDSA, SHA-256, PBKDF2, AES-CBC |
| Browser file handling | File API, FileReader, Blob downloads |
| Desktop interface | Python, Tkinter, ttk |
| Python cryptography | `cryptography==42.0.5` |
| Data formats | PEM keys, JSON signature files, JSON audit logs |
| Static deployment | GitHub Actions and GitHub Pages |
| Web fonts | Orbitron, Exo 2, and Share Tech Mono through Google Fonts |

## Repository structure

| Path | Purpose |
| --- | --- |
| `public/index.html` | Web interface and its five application sections |
| `public/style.css` | Theme, layout, responsive navigation, and component styles |
| `public/app.js` | Browser cryptography, key protection, signing, verification, benchmarks, and session logs |
| `gui.py` | Desktop application entry point and Tkinter interface |
| `keygen.py` | RSA/ECDSA key generation and PEM key loading |
| `sign.py` | Single-file and batch signing |
| `verify.py` | Signature verification and tamper demonstration |
| `compare.py` | Python RSA/ECDSA performance comparison |
| `utils.py` | SHA-256 hashing, Base64 conversion, file information, directory initialization, and audit logging |
| `requirements.txt` | Pinned Python dependency |
| `keys/` | Desktop key output; the repository also contains example key files |
| `signed_files/` | Desktop signature output and an included sample signature |
| `logs/audit_log.json` | Desktop audit history |
| `.github/workflows/static.yml` | GitHub Pages workflow publishing only `public/` |
| `__pycache__/` | Generated Python bytecode currently included in the repository |

## Run the web edition

### Requirements

- A modern browser with Web Crypto API support.
- An HTTPS address or a local development address such as `http://localhost:8000`.
- Any static file server. Python is one convenient option for serving files; it does not execute the web app's cryptographic operations.

### Start locally

Clone the repository:

```bash
git clone https://github.com/vasanth-kumar-009/digital-signature-system.git
cd digital-signature-system
```

Serve **only the frontend directory**:

```bash
python -m http.server 8000 --bind 127.0.0.1 --directory public
```

Open:

```text
http://localhost:8000
```

On Windows, use `py` instead of `python` if that is the available launcher. On macOS/Linux, use `python3` where needed.

No `pip install`, `npm install`, backend server, or environment variables are required for the web edition. Stop the local server with `Ctrl+C`.

## Run the desktop edition

### Requirements

- Python with Tkinter support. Python 3.12 is a practical starting point for the pinned dependency; newer Python versions may require dependency updates.
- A graphical desktop session.
- The package listed in `requirements.txt`.

Run the following commands from the repository root.

### Windows PowerShell

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python gui.py
```

If PowerShell blocks activation, use the environment's interpreter directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe gui.py
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python gui.py
```

If Tkinter is missing on Debian/Ubuntu, install the distribution package:

```bash
sudo apt install python3-tk
```

The application creates `keys/`, `signed_files/`, and `logs/` relative to the current working directory when its utilities are imported. Launching from the repository root keeps these outputs together.

## Usage guide

### 1. Generate a key pair

1. Open **Key Generation** in the web app or **1. Generate Keys** in the desktop app.
2. Select RSA or ECDSA.
3. For RSA, select a key size. Use 2048 or 4096 bits for meaningful demonstrations; 1024-bit RSA is a legacy option.
4. Optionally enter a password to encrypt the saved private key. The web edition requires at least eight characters when a password is supplied.
5. Generate the keys.
6. In the web edition, download both PEM files. In the desktop edition, note the displayed output paths.

Web downloads use the key label, for example `my-key_private.pem` and `my-key_public.pem`. Desktop filenames are fixed: `rsa_private.pem`, `rsa_public.pem`, `ecdsa_private.pem`, and `ecdsa_public.pem`.

Keep the private key and its password secret. Share the public key with recipients through a trusted channel.

### 2. Sign a file

1. Open **Sign Document** or **2. Sign File**.
2. Select the file to sign. Files are processed as bytes, so the application can sign text, PDFs, images, archives, and other file types.
3. Supply the private key. The web edition accepts an uploaded PEM file or pasted PEM text.
4. Select the algorithm matching that key.
5. Enter the signer name and the private-key password, if required.
6. Sign the file and save the generated `.sig` file.

For `report.pdf`, the signature filename is `report.pdf.sig`. Signing creates a detached signature; it does not add a visible signature or embedded certificate to the PDF.

### 3. Verify a file

1. Open **Verify Document** or **3. Verify File**.
2. Select the original file.
3. Select its corresponding `.sig` file.
4. Supply the signer's public key.
5. Click **Verify**.

A valid result requires both a matching SHA-256 file hash and successful cryptographic signature verification. The interface displays the signer metadata, algorithm, timestamp, and original/current hashes.

Recipients need the original file, its detached signature, and the correct public key. They do not need the private key or its password.

### 4. Demonstrate tampering

Use **Tamper Demo** or **Tamper + Verify Demo** with an otherwise valid file/signature/key combination.

The demo appends ` [TAMPERED]` to a copy of the selected content and verifies it against the original signature. Verification should fail. The selected original file is preserved.

The Python demo temporarily uses `<original-path>.tampered`; avoid using it where a file with that name already exists, because the helper overwrites and then deletes that path.

### 5. Inspect audit history

- **Web:** review operation entries and counters, export them as `audit_log.json`, or clear them. Logs and counters reset on refresh.
- **Desktop:** open **5. Audit Log** to read signing and verification events from `logs/audit_log.json`. The log refreshes when the tab is selected and through **Refresh Logs**.

Desktop key generation is not written to the audit log. Desktop benchmark signing and verification use the same logging functions as normal operations.

## How signing and verification work

1. Generate an asymmetric private/public key pair.
2. Compute the selected file's SHA-256 digest.
3. Sign using RSA-PSS with SHA-256 or ECDSA with SHA-256.
4. Store the Base64 signature and supporting metadata in a detached JSON file.
5. During verification, recompute the file hash and use the public key to validate the signature.
6. Accept the file only when both checks succeed.

The browser passes the file bytes to Web Crypto, which performs hashing internally for signing. Python computes the digest explicitly and uses `Prehashed(SHA256())`, avoiding a second hash of that digest.

Digital signatures provide evidence of file integrity and possession of the corresponding private key. Associating a public key with a real person requires a separate trusted process.

## File formats and compatibility

### Keys

| Key | Encoding | PEM header |
| --- | --- | --- |
| Unprotected private key | PKCS#8 | `-----BEGIN PRIVATE KEY-----` |
| Password-protected private key | Encrypted PKCS#8 | `-----BEGIN ENCRYPTED PRIVATE KEY-----` |
| Public key | SubjectPublicKeyInfo (SPKI) | `-----BEGIN PUBLIC KEY-----` |

The browser encrypts private keys with PBES2, PBKDF2-HMAC-SHA-256 at 600,000 iterations, a random 16-byte salt, and AES-256-CBC with a random 16-byte IV. Python delegates encrypted-key serialization to `BestAvailableEncryption`.

Browser encrypted-key import supports PBES2 with PBKDF2-HMAC-SHA-256 and AES-256-CBC, subject to its parameter checks. It does not accept every encrypted PEM format. Python-generated encrypted keys are usable in the browser only when their encryption parameters match the supported subset.

### Signature JSON

Each `.sig` file contains these fields:

| Field | Meaning |
| --- | --- |
| `signer` | User-entered display name |
| `file` | Original file's basename |
| `file_hash` | SHA-256 digest as a 64-character hexadecimal string |
| `algorithm` | `RSA` or `ECDSA` |
| `timestamp` | ISO-formatted signing time |
| `signature` | Base64-encoded signature bytes |

The browser uses a UTC ISO timestamp ending in `Z`; Python uses a local ISO timestamp without an explicit timezone offset.

### Signature interoperability

- Normal browser RSA signing uses the maximum SHA-256 RSA-PSS salt length, matching Python's `PSS.MAX_LENGTH` setting.
- Browser RSA verification also attempts a 32-byte salt for compatibility with signatures using that setting.
- Browser ECDSA signing converts Web Crypto's raw P-256 signature into DER before saving, matching Python's signature representation.
- Browser ECDSA verification accepts both raw 64-byte signatures and DER signatures. Python expects DER.

These choices support exchange of signatures generated by the normal signing flows in the two editions. Compatibility with arbitrary third-party signature formats is not guaranteed.

## Performance comparison

Both editions compare RSA-2048 with ECDSA P-256 and report:

- Key generation time.
- Signing time.
- Verification time.
- Private-key size.
- Public-key size.
- Signature size.

### Browser benchmark

Upload an optional test file or use the default **32 KiB of random data**, then choose **1, 3, or 5 iterations**. The app reports average operation times and a visual comparison table.

Key sizes are exported DER byte lengths; signature sizes are raw Web Crypto signature byte lengths. The benchmark uses a 32-byte RSA-PSS salt and raw ECDSA signatures, while normal signing uses the interoperability formats described above. Benchmark keys stay in memory and do not replace downloaded keys.

### Desktop benchmark

Select a test file and run the comparison. Measurements include the work performed by the Python helpers, such as file I/O, serialization, hashing, and audit logging. Key sizes are PEM file sizes; signature sizes are entire `.sig` JSON file sizes. These sizes and timings are not directly comparable with the browser's measurements.

**Back up desktop keys before benchmarking.** `run_comparison()` generates unencrypted keys at the fixed paths in `keys/`, replacing existing RSA and ECDSA key files. Both algorithms also use the same signature output filename, so the ECDSA benchmark overwrites the RSA benchmark's `.sig` file and any earlier signature at that path.

Results depend on hardware, runtime, file size, and measurement overhead. This benchmark compares the selected configurations; it does not establish equivalent security strength or a universal fastest algorithm.

## Python module usage

The modules can be used independently of Tkinter. Run examples from the repository root, with the Python dependencies installed.

### Generate keys, sign, and verify

This example creates new files and replaces the default RSA key files if they already exist:

```python
from getpass import getpass
from pathlib import Path

import utils  # Initializes keys/, signed_files/, and logs/.
from keygen import generate_rsa_keys
from sign import sign_file
from verify import verify_file, tamper_and_verify

Path("example.txt").write_text("Hello, digital signatures!\n", encoding="utf-8")
password = getpass("New private-key password: ") or None

private_path, public_path = generate_rsa_keys(
    password=password,
    key_size=2048,
)

signature_path, file_hash = sign_file(
    "example.txt",
    private_path,
    algorithm="RSA",
    password=password,
    signer_name="Demo Signer",
)

print("SHA-256:", file_hash)
print("Original:", verify_file("example.txt", signature_path, public_path))
print("Tamper demo:", tamper_and_verify("example.txt", signature_path, public_path))
```

For ECDSA, use `generate_ecdsa_keys(password=password)` and pass `algorithm="ECDSA"` to `sign_file()`.

### Batch signing

After creating `private_path` and `password` as above, supply paths to existing files:

```python
from sign import sign_multiple_files

results = sign_multiple_files(
    ["example.txt", "report.pdf"],
    private_path,
    algorithm="RSA",
    password=password,
    signer_name="Demo Signer",
)

for result in results:
    print(result)
```

The helper returns one result per file, including a success status, signature path, and hash, or a failure status and error. Files with identical basenames share the same output filename even when their source directories differ.

## GitHub Pages deployment

The repository contains `.github/workflows/static.yml`, which publishes the contents of `public/`.

1. Push the repository to GitHub with the frontend files inside `public/`.
2. Open the repository's **Settings → Pages**.
3. Set the build/deployment source to **GitHub Actions**.
4. Push a change to `main`, or manually run **Deploy static content to Pages** from the **Actions** tab.
5. Use the deployment URL reported by the workflow after it succeeds.

For this repository, the conventional project-site address is:

```text
https://vasanth-kumar-009.github.io/digital-signature-system/
```

That address depends on Pages being enabled and deployment succeeding. GitHub Pages serves the web edition only; it does not run `gui.py` or the Python modules.

For another static host, publish `public/` as the site root with HTTPS enabled. There is no build command or required backend configuration.

## Security and current limitations

- **Included private keys are public demo material.** Generate fresh keys for your own use. If committed keys were ever used for real signing, replace them and distribute the new public keys through a trusted channel. Removing a key from the latest commit does not remove its history.
- **Passwords protect saved private-key files.** They are not account passwords or a login system, and there is no password recovery feature.
- **Metadata is not signed as a complete JSON object.** The signature authenticates file content, while fields such as `signer`, `file`, and `timestamp` are descriptive metadata. Editing those fields can leave file-content verification valid. The timestamp is not a trusted timestamp.
- **Public keys are supplied by the user.** The project does not implement certificates, identity verification, a certificate authority, revocation checks, or a public-key directory.
- **Files are signed, not encrypted.** Signing does not hide document contents or add a visible signature to a document.
- **RSA-1024 is a legacy demonstration option.** Prefer the larger RSA options or ECDSA P-256 for demonstrations using current configurations.
- **Desktop output paths are fixed.** Repeated key generation replaces the existing key pair for that algorithm. Re-signing a basename replaces its prior signature. Preserve older keys and signatures when needed.
- **Browser session data is temporary.** Generated keys, selected files, signatures, and audit entries are kept in page memory. Download needed outputs before refreshing or closing the page. Only the sidebar preference is stored in `localStorage`.
- **Browser operations process whole files in memory.** Very large files can consume substantial memory. Python's hashing utility reads files in 8 KiB chunks.
- **Audit logs are ordinary JSON.** They can be edited and are not tamper-evident or designed for concurrent writers.
- **No document upload API is implemented.** Browser signing and verification run locally. The page still loads web resources, including external Google Fonts; it is not packaged as a fully offline PWA.
- **The repository has no automated test suite or dedicated test workflow.** The included GitHub Actions workflow is for static deployment.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Web Crypto unavailable | Open the app through `http://localhost:8000` or HTTPS. Plain HTTP on a LAN address may not provide the required secure context. |
| `Algorithm: Unrecognized name` | Use the current `public/app.js`, clear cached assets, and use a browser supporting `RSA-PSS` and `ECDSA`. The current code uses `RSA-PSS` as the Web Crypto algorithm name. |
| Page opens but scripts/styles are missing | Serve `public/` as the root and keep `index.html`, `app.js`, and `style.css` together. |
| Python server cannot bind to port 8000 | Use another port, such as `8001`, and open the corresponding localhost URL. |
| Private key will not load | Confirm it is a supported PKCS#8 PEM private key and matches the selected algorithm. For encrypted keys, enter the correct password. |
| `Incorrect password or damaged private key` | Recheck the password and use the original, complete PEM. Unsupported encrypted-key formats may need a compatible conversion outside this application. |
| Signature is invalid | Check that the document bytes, signature file, and public key belong together. Editing or re-saving the document can change its bytes. |
| Invalid signature JSON | Use a `.sig` generated by the app. It must contain a supported algorithm, a SHA-256 hex digest, and a Base64 signature. |
| Previously valid desktop signatures stop verifying | Check whether new key generation or a desktop benchmark replaced the public/private key files. |
| `ModuleNotFoundError: cryptography` | Install `requirements.txt` using the same Python interpreter that launches `gui.py`. |
| Dependency installation fails on a newer Python | Try Python 3.12 with the pinned dependency, or update dependencies separately after checking compatibility. |
| Tkinter is missing or no display is available | Install Tkinter for the selected interpreter and run the desktop app in a graphical session. |
| Clipboard copy fails | Use the key download button; clipboard access can be restricted by browser permissions or context. |
| Audit entries disappear after refresh | Web logs are session-only. Export them before refreshing. Desktop logs are stored separately on disk. |

## Contributing

1. Fork the repository and create a branch for your change.
2. Keep the web and desktop implementations independently runnable.
3. Check key generation, password-protected signing, valid verification, wrong-key rejection, and tamper detection for both algorithms affected by your change.
4. If modifying key or signature formats, check compatibility between editions.
5. Open a pull request describing the change and the validation performed.

Use disposable keys and files for validation, especially when running the desktop benchmark. Avoid committing private keys, personal audit logs, generated bytecode, or virtual environments.

