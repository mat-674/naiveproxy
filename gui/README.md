# NaiveProxy GUI Client

A simple, cross-platform GUI client for NaiveProxy, built with Python and Tkinter.

## Requirements

*   Python 3.x
*   `naive` binary (downloaded from NaiveProxy releases)

**Linux Note:** Ensure `python3-tk` is installed (e.g., `sudo apt install python3-tk`).

## Installation

No special installation is required if you have Python installed.
If you want to run this on Windows without installing Python, you can use `pyinstaller` to build an executable:

```bash
pip install pyinstaller
pyinstaller --onefile --noconsole naive_gui.py
```

## Usage

1.  Run the script:
    ```bash
    python3 naive_gui.py
    ```
2.  In the GUI:
    *   **Executable**: Select the path to your `naive` binary (e.g., `naive.exe` or `./naive`).
    *   **Config**: Edit the Listen and Proxy URLs, or use the "Advanced" tab to edit the JSON directly.
    *   **Control**: Click "Start" to run the proxy. Logs will appear in the bottom window.

## Troubleshooting

*   If the proxy fails to start, check the "Logs" window for error messages.
*   Ensure the paths in the config are correct.
