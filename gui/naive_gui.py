import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import subprocess
import threading
import queue
import sys

# Constants
CONFIG_FILE = "config.json"
SETTINGS_FILE = "gui_settings.json"

class GuiSettings:
    def __init__(self):
        self.executable_path = ""
        self.load()

    def load(self):
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, 'r') as f:
                    data = json.load(f)
                    self.executable_path = data.get("executable_path", "")
            except:
                pass

    def save(self):
        data = {"executable_path": self.executable_path}
        try:
            with open(SETTINGS_FILE, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            print(f"Error saving settings: {e}")

class MainWindow(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("NaiveProxy Client")
        self.geometry("600x500")

        self.settings = GuiSettings()
        self.process = None
        self.log_queue = queue.Queue()
        self.is_running = False

        self.create_widgets()
        self.check_queue()

        # Load config initially
        self.load_config_to_ui()

    def create_widgets(self):
        # --- Top Control Frame ---
        control_frame = ttk.LabelFrame(self, text="Control")
        control_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(control_frame, text="Executable:").pack(side="left", padx=5)
        self.exe_path_var = tk.StringVar(value=self.settings.executable_path)
        ttk.Entry(control_frame, textvariable=self.exe_path_var).pack(side="left", fill="x", expand=True, padx=5)
        ttk.Button(control_frame, text="Browse", command=self.browse_exe).pack(side="left", padx=5)

        self.start_btn = ttk.Button(control_frame, text="Start Proxy", command=self.toggle_proxy)
        self.start_btn.pack(side="left", padx=10)

        self.status_var = tk.StringVar(value="Stopped")
        self.status_label = ttk.Label(control_frame, textvariable=self.status_var, foreground="red")
        self.status_label.pack(side="left", padx=5)

        # --- Configuration Frame (Tabs) ---
        config_frame = ttk.LabelFrame(self, text="Configuration")
        config_frame.pack(fill="both", expand=True, padx=10, pady=5)

        self.notebook = ttk.Notebook(config_frame)
        self.notebook.pack(fill="both", expand=True, padx=5, pady=5)

        # Tab 1: Simple
        self.simple_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.simple_tab, text="Simple")

        ttk.Label(self.simple_tab, text="Listen (e.g. socks://127.0.0.1:1080):").pack(anchor="w", padx=5, pady=2)
        self.listen_var = tk.StringVar()
        ttk.Entry(self.simple_tab, textvariable=self.listen_var).pack(fill="x", padx=5, pady=2)

        ttk.Label(self.simple_tab, text="Proxy (e.g. https://user:pass@example.com):").pack(anchor="w", padx=5, pady=2)
        self.proxy_var = tk.StringVar()
        ttk.Entry(self.simple_tab, textvariable=self.proxy_var).pack(fill="x", padx=5, pady=2)

        ttk.Button(self.simple_tab, text="Save to Config", command=self.save_simple_config).pack(pady=10)

        # Tab 2: Advanced (JSON)
        self.advanced_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.advanced_tab, text="Advanced (JSON)")

        self.json_text = tk.Text(self.advanced_tab, wrap="none", font=("Courier", 10))
        self.json_text.pack(fill="both", expand=True, padx=5, pady=5)

        btn_frame = ttk.Frame(self.advanced_tab)
        btn_frame.pack(fill="x", padx=5, pady=5)
        ttk.Button(btn_frame, text="Load from File", command=self.load_config_to_ui).pack(side="left")
        ttk.Button(btn_frame, text="Save to File", command=self.save_json_config).pack(side="left", padx=5)

        # --- Log Frame ---
        log_frame = ttk.LabelFrame(self, text="Logs")
        log_frame.pack(fill="both", expand=True, padx=10, pady=5)

        self.log_text = tk.Text(log_frame, state="disabled", wrap="word", height=10, font=("Courier", 9))
        self.log_text.pack(side="left", fill="both", expand=True)

        scrollbar = ttk.Scrollbar(log_frame, command=self.log_text.yview)
        scrollbar.pack(side="right", fill="y")
        self.log_text.config(yscrollcommand=scrollbar.set)

    def browse_exe(self):
        filename = filedialog.askopenfilename(title="Select Naive Executable")
        if filename:
            self.exe_path_var.set(filename)
            self.settings.executable_path = filename
            self.settings.save()

    def load_config_to_ui(self):
        if not os.path.exists(CONFIG_FILE):
            # Default config
            default_config = {
                "listen": "socks://127.0.0.1:1080",
                "proxy": ""
            }
            try:
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(default_config, f, indent=2)
            except:
                pass

        try:
            with open(CONFIG_FILE, 'r') as f:
                content = f.read()
                # Update JSON tab
                self.json_text.delete("1.0", tk.END)
                self.json_text.insert("1.0", content)

                # Try to parse for Simple tab
                data = json.loads(content)
                listen = data.get("listen", "")
                if isinstance(listen, list):
                    listen = listen[0] if listen else ""

                proxy = data.get("proxy", "")
                if isinstance(proxy, list):
                    proxy = proxy[0] if proxy else ""

                self.listen_var.set(str(listen))
                self.proxy_var.set(str(proxy))
        except Exception as e:
            self.log(f"Error loading config: {e}")

    def save_simple_config(self):
        listen = self.listen_var.get()
        proxy = self.proxy_var.get()

        # Try to preserve existing config structure
        try:
            # First try to parse what is in the Advanced tab to get the latest state including any manual edits
            current_content = self.json_text.get("1.0", tk.END).strip()
            if current_content:
                data = json.loads(current_content)
            else:
                # Fallback to reading file
                if os.path.exists(CONFIG_FILE):
                    with open(CONFIG_FILE, 'r') as f:
                        data = json.load(f)
                else:
                    data = {}
        except:
            data = {}

        data["listen"] = listen
        data["proxy"] = proxy

        try:
            json_str = json.dumps(data, indent=2)
            with open(CONFIG_FILE, 'w') as f:
                f.write(json_str)

            # Update JSON tab
            self.json_text.delete("1.0", tk.END)
            self.json_text.insert("1.0", json_str)

            messagebox.showinfo("Success", "Configuration saved!")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save config: {e}")

    def save_json_config(self):
        content = self.json_text.get("1.0", tk.END).strip()
        try:
            # Validate JSON
            data = json.loads(content)

            with open(CONFIG_FILE, 'w') as f:
                f.write(content)

            # Update Simple tab
            listen = data.get("listen", "")
            if isinstance(listen, list): listen = listen[0] if listen else ""
            proxy = data.get("proxy", "")
            if isinstance(proxy, list): proxy = proxy[0] if proxy else ""
            self.listen_var.set(str(listen))
            self.proxy_var.set(str(proxy))

            messagebox.showinfo("Success", "Configuration saved!")
        except json.JSONDecodeError as e:
            messagebox.showerror("Error", f"Invalid JSON: {e}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save config: {e}")

    def toggle_proxy(self):
        if self.is_running:
            self.stop_proxy()
        else:
            self.start_proxy()

    def start_proxy(self):
        exe = self.exe_path_var.get()
        if not exe:
            messagebox.showerror("Error", "Please select the naive executable first.")
            return

        if not os.path.exists(exe):
            messagebox.showerror("Error", f"Executable not found: {exe}")
            return

        self.start_btn.config(state="disabled")

        def run_thread():
            try:
                # Use stdbuf or -u if possible for python mock, but for real binary it should be fine?
                # For python mock, we need to ensure it flushes.
                cmd = [exe, CONFIG_FILE]

                # Check if it is a python script (our mock)
                if exe.endswith(".py"):
                    cmd = [sys.executable, exe, CONFIG_FILE]

                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )

                self.log_queue.put(("STATUS", "Running"))

                for line in self.process.stdout:
                    self.log_queue.put(("LOG", line))

                self.process.wait()
                self.log_queue.put(("STATUS", "Stopped"))
                self.log_queue.put(("LOG", f"Process exited with code {self.process.returncode}\n"))
            except Exception as e:
                self.log_queue.put(("LOG", f"Error running process: {e}\n"))
                self.log_queue.put(("STATUS", "Stopped"))

        self.worker_thread = threading.Thread(target=run_thread, daemon=True)
        self.worker_thread.start()

    def stop_proxy(self):
        if self.process:
            self.log("Stopping proxy...\n")
            self.process.terminate()
            # self.process.wait() # Don't block UI, let thread handle exit
        self.start_btn.config(state="disabled")

    def check_queue(self):
        try:
            while True:
                msg_type, content = self.log_queue.get_nowait()
                if msg_type == "LOG":
                    self.log(content)
                elif msg_type == "STATUS":
                    if content == "Running":
                        self.is_running = True
                        self.start_btn.config(text="Stop Proxy", state="normal")
                        self.status_var.set("Running")
                        self.status_label.config(foreground="green")
                    else:
                        self.is_running = False
                        self.start_btn.config(text="Start Proxy", state="normal")
                        self.status_var.set("Stopped")
                        self.status_label.config(foreground="red")
        except queue.Empty:
            pass

        self.after(100, self.check_queue)

    def log(self, message):
        self.log_text.config(state="normal")
        self.log_text.insert(tk.END, message)
        self.log_text.see(tk.END)
        self.log_text.config(state="disabled")

    def on_closing(self):
        if self.is_running:
            if messagebox.askokcancel("Quit", "Proxy is running. Stop and quit?"):
                self.stop_proxy()
                self.destroy()
        else:
            self.destroy()

if __name__ == "__main__":
    app = MainWindow()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
