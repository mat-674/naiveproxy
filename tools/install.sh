#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root${NC}"
  exit 1
fi

# Function to install dependencies
install_dependencies() {
    echo -e "${YELLOW}Installing dependencies...${NC}"
    if command -v apt-get &> /dev/null; then
        apt-get update -y
        apt-get install -y curl wget tar jq libcap2-bin ufw
    elif command -v yum &> /dev/null; then
        yum install -y curl wget tar jq libcap ufw
    else
        echo -e "${RED}Unsupported package manager. Please install curl, wget, tar, jq manually.${NC}"
        exit 1
    fi
}

# Function to get random string
generate_random() {
    tr -dc A-Za-z0-9 </dev/urandom | head -c 12 ; echo ''
}

# Interactive Setup
setup_interactive() {
    echo -e "${GREEN}=== NaïveProxy Server Installer ===${NC}"

    # 1. Domain
    echo -n "Enter domain name (e.g., example.com): "
    read DOMAIN
    if [ -z "$DOMAIN" ]; then
        echo -e "${RED}Domain is required for HTTPS!${NC}"
        exit 1
    fi

    # 2. Email
    echo -n "Enter email for Let's Encrypt (optional): "
    read EMAIL

    # 3. Username
    DEFAULT_USER=$(generate_random)
    echo -n "Enter username [${DEFAULT_USER}]: "
    read USERNAME
    USERNAME=${USERNAME:-$DEFAULT_USER}

    # 4. Password
    DEFAULT_PASS=$(generate_random)
    echo -n "Enter password [${DEFAULT_PASS}]: "
    read PASSWORD
    PASSWORD=${PASSWORD:-$DEFAULT_PASS}

    # 5. Installation Method
    echo -e "${YELLOW}Select installation method:${NC}"
    echo "1) Download pre-built binary (Faster)"
    echo "2) Build from source (Slower, requires Go)"
    echo -n "Choice [1]: "
    read METHOD
    METHOD=${METHOD:-1}
}

# Method A: Download Binary
install_binary() {
    echo -e "${YELLOW}Attempting to download latest binary...${NC}"
    ARCH=$(uname -m)

    # The pre-built binary is typically for amd64
    if [ "$ARCH" != "x86_64" ]; then
        echo -e "${YELLOW}Pre-built binary usually supports amd64 only. You are on $ARCH. Will try to build from source.${NC}"
        return 1
    fi

    # Try to find URL for the generic name caddy-forwardproxy-naive.tar.xz
    LATEST_URL=$(curl -s https://api.github.com/repos/klzgrad/forwardproxy/releases/latest | jq -r '.assets[] | select(.name == "caddy-forwardproxy-naive.tar.xz") | .browser_download_url' | head -n 1)

    if [ -z "$LATEST_URL" ] || [ "$LATEST_URL" == "null" ]; then
        echo -e "${RED}Could not find binary URL. Switching to build from source...${NC}"
        return 1
    fi

    echo "Downloading from $LATEST_URL..."
    TMP_DIR=$(mktemp -d)

    if ! wget -O "$TMP_DIR/caddy.tar.xz" "$LATEST_URL"; then
        echo -e "${RED}Download failed.${NC}"
        rm -rf "$TMP_DIR"
        return 1
    fi

    if ! tar -xf "$TMP_DIR/caddy.tar.xz" -C "$TMP_DIR"; then
         echo -e "${RED}Extraction failed.${NC}"
         rm -rf "$TMP_DIR"
         return 1
    fi

    BIN=$(find "$TMP_DIR" -type f -executable -name "caddy" | head -n 1)
    if [ -n "$BIN" ]; then
        mv "$BIN" /usr/bin/caddy
        chmod +x /usr/bin/caddy
        rm -rf "$TMP_DIR"
        return 0
    else
         echo -e "${RED}Binary not found in archive.${NC}"
         rm -rf "$TMP_DIR"
         return 1
    fi
}

# Method B: Build from Source
build_source() {
    echo -e "${YELLOW}Building from source... This may take a while.${NC}"

    # Install Go if not present
    if ! command -v go &> /dev/null; then
        echo "Installing Go..."
        wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
        rm -rf /usr/local/go && tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz
        export PATH=$PATH:/usr/local/go/bin
        rm go1.21.6.linux-amd64.tar.gz
    fi

    # Install xcaddy
    echo "Installing xcaddy..."
    go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest

    TMP_BUILD=$(mktemp -d)
    pushd "$TMP_BUILD" > /dev/null
    ~/go/bin/xcaddy build --with github.com/caddyserver/forwardproxy=github.com/klzgrad/forwardproxy@naive

    if [ -f "caddy" ]; then
        mv caddy /usr/bin/caddy
        chmod +x /usr/bin/caddy
        popd > /dev/null
        rm -rf "$TMP_BUILD"
    else
        echo -e "${RED}Build failed.${NC}"
        popd > /dev/null
        rm -rf "$TMP_BUILD"
        exit 1
    fi
}

# Configure Caddy
configure_caddy() {
    echo -e "${YELLOW}Configuring Caddy...${NC}"
    mkdir -p /etc/caddy

    if [ -n "$EMAIL" ]; then
        TLS_CONFIG="tls $EMAIL"
    else
        TLS_CONFIG=""
    fi

    cat > /etc/caddy/Caddyfile <<EOF
{
  order forward_proxy before file_server
}
$DOMAIN {
  $TLS_CONFIG
  forward_proxy {
    basic_auth $USERNAME $PASSWORD
    hide_ip
    hide_via
    probe_resistance
  }
  file_server {
    root /var/www/html
  }
}
EOF

    # Create dummy index.html for probe resistance
    mkdir -p /var/www/html
    if [ ! -f /var/www/html/index.html ]; then
        echo "<h1>Welcome to nginx!</h1>" > /var/www/html/index.html
    fi
}

# Setup Systemd
setup_systemd() {
    echo -e "${YELLOW}Setting up Systemd service...${NC}"

    # Allow caddy to bind ports < 1024
    setcap cap_net_bind_service=+ep /usr/bin/caddy

    cat > /etc/systemd/system/naive.service <<EOF
[Unit]
Description=Caddy with NaiveProxy
Documentation=https://caddyserver.com/docs/
After=network.target network-online.target
Requires=network-online.target

[Service]
User=root
Group=root
ExecStart=/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable naive
    systemctl restart naive
}

# Setup Firewall
setup_firewall() {
    echo -e "${YELLOW}Configuring Firewall...${NC}"
    if command -v ufw &> /dev/null; then
        ufw allow 80
        ufw allow 443
        ufw reload
    else
        iptables -I INPUT -p tcp --dport 80 -j ACCEPT
        iptables -I INPUT -p tcp --dport 443 -j ACCEPT
    fi
}

# Main execution
install_dependencies
setup_interactive

if [ "$METHOD" == "1" ]; then
    if ! install_binary; then
        echo -e "${YELLOW}Binary installation failed. Falling back to source build.${NC}"
        build_source
    fi
else
    build_source
fi

configure_caddy
setup_systemd
setup_firewall

# Final Output
echo -e "${GREEN}=== Installation Complete ===${NC}"
echo -e "Domain: ${DOMAIN}"
echo -e "User: ${USERNAME}"
echo -e "Pass: ${PASSWORD}"
echo -e ""
echo -e "${YELLOW}Client Link:${NC}"
echo -e "naiveproxy://https://${USERNAME}:${PASSWORD}@${DOMAIN}"
echo -e ""
echo -e "${YELLOW}JSON Config:${NC}"
echo "{"
echo "  \"listen\": \"socks://127.0.0.1:1080\","
echo "  \"proxy\": \"https://${USERNAME}:${PASSWORD}@${DOMAIN}\""
echo "}"
