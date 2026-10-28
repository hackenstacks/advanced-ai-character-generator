#!/bin/bash

################################################################################
#                                                                              #
#          AI CHARACTER GENERATOR - NEXUS LAUNCH SCRIPT                        #
#          Beautiful Production Deployment Automation                          #
#                                                                              #
################################################################################

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
BOLD='\033[1m'
DIM='\033[2m'
ITALIC='\033[3m'
UNDERLINE='\033[4m'
BLINK='\033[5m'
RESET='\033[0m'

# Unicode characters
CHECK_MARK="✓"
CROSS_MARK="✗"
ROCKET="🚀"
LOCK="🔐"
FIRE="🔥"
STAR="⭐"
GEAR="⚙️"
PACKAGE="📦"
SERVER="🖥️"
GLOBE="🌐"
SHIELD="🛡️"
LIGHTNING="⚡"
SPARKLES="✨"
PROGRESS="▓"

# Configuration
PROJECT_NAME="AI Character Generator"
VERSION="2.0.0"
DEFAULT_PORT=8443
BUILD_DIR="dist"
SSL_CERT="cert.pem"
SSL_KEY="key.pem"
# NeXuS Web Server (portable stdlib HTTPS host + shared /api/* key-injecting proxy).
# Shared home first; fall back to an in-project copy if present.
if [ -f "$HOME/Projects/nexus-web-server/nexus_web_server.py" ]; then
    NEXUS_WEB_SERVER="$HOME/Projects/nexus-web-server/nexus_web_server.py"
else
    NEXUS_WEB_SERVER="nexus_web_server.py"
fi

################################################################################
# Helper Functions
################################################################################

# Print colored message
print_color() {
    local color=$1
    shift
    echo -e "${color}$@${RESET}"
}

# Print section header
print_header() {
    echo ""
    print_color "$CYAN" "╔════════════════════════════════════════════════════════════════════════╗"
    print_color "$CYAN" "║  $1"
    print_color "$CYAN" "╚════════════════════════════════════════════════════════════════════════╝"
    echo ""
}

# Print step with icon
print_step() {
    local icon=$1
    local message=$2
    print_color "$WHITE" "${icon}  ${BOLD}${message}${RESET}"
}

# Print success message
print_success() {
    print_color "$GREEN" "${CHECK_MARK}  $1"
}

# Print error message
print_error() {
    print_color "$RED" "${CROSS_MARK}  $1"
}

# Print warning message
print_warning() {
    print_color "$YELLOW" "⚠️   $1"
}

# Print info message
print_info() {
    print_color "$BLUE" "ℹ️   $1"
}

# Animated spinner
spinner() {
    local pid=$1
    local message=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0

    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %10 ))
        printf "\r${CYAN}${spin:$i:1}${RESET}  ${message}..."
        sleep 0.1
    done
    printf "\r"
}

# Progress bar
progress_bar() {
    local duration=$1
    local width=50
    local progress=0

    while [ $progress -le $width ]; do
        local percent=$((progress * 100 / width))
        local filled=$(printf "%${progress}s" | tr ' ' '▓')
        local empty=$(printf "%$((width - progress))s" | tr ' ' '░')

        printf "\r${CYAN}[${filled}${empty}] ${percent}%%${RESET}"

        progress=$((progress + 1))
        sleep $(echo "scale=3; $duration / $width" | bc)
    done
    printf "\r${GREEN}[%${width}s] 100%%${RESET}\n" | tr ' ' '▓'
}

# ASCII Art Banner
print_banner() {
    clear
    print_color "$MAGENTA" ""
    print_color "$MAGENTA" "███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗"
    print_color "$MAGENTA" "████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝"
    print_color "$CYAN"    "██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗"
    print_color "$BLUE"    "██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║"
    print_color "$BLUE"    "██║ ╚████║███████╗██╔╝ ╚██╗╚██████╔╝███████║"
    print_color "$BLUE"    "╚═╝  ╚═══╝╚══════╝╚═╝   ╚═╝ ╚═════╝ ╚══════╝"
    print_color "$WHITE"   ""
    print_color "$WHITE"   "${BOLD}     ${PROJECT_NAME} ${RESET}${DIM}v${VERSION}${RESET}"
    print_color "$GRAY"    "     Sane • Simple • Secure"
    print_color "$WHITE"   ""
    print_color "$GRAY"    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check system requirements
check_requirements() {
    print_header "${GEAR} System Requirements Check"

    local all_good=true

    # Check Python 3 (required — production HTTPS server is pure-Python stdlib)
    print_step "${PACKAGE}" "Checking Python 3..."
    if command_exists python3; then
        local py_version=$(python3 --version 2>&1 | cut -d' ' -f2)
        print_success "Python ${py_version} installed"
    else
        print_error "Python 3 not found! Required for the production HTTPS server."
        all_good=false
    fi

    # Check Node.js / npm (OPTIONAL — only needed to (re)build dist/ or run Dev/Vite mode)
    print_step "${PACKAGE}" "Checking Node.js (optional, dev/build only)..."
    if command_exists node; then
        print_success "Node.js $(node --version) installed"
    else
        print_warning "Node.js not found — fine for production serving; needed only to rebuild or run Dev mode"
    fi

    # Check OpenSSL
    print_step "${LOCK}" "Checking OpenSSL..."
    if command_exists openssl; then
        local ssl_version=$(openssl version | cut -d' ' -f2)
        print_success "OpenSSL ${ssl_version} installed"
    else
        print_warning "OpenSSL not found (optional for cert generation)"
    fi

    # Check available ports
    print_step "${SERVER}" "Checking port availability..."
    if lsof -i:${DEFAULT_PORT} >/dev/null 2>&1; then
        print_warning "Port ${DEFAULT_PORT} is in use"
        print_info "You can specify a different port or stop the conflicting process"
    else
        print_success "Port ${DEFAULT_PORT} is available"
    fi

    echo ""

    if [ "$all_good" = false ]; then
        print_error "System requirements not met. Please install missing dependencies."
        exit 1
    fi
}

# Check SSL certificates
check_ssl_certificates() {
    print_header "${LOCK} SSL Certificate Check"

    if [ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ]; then
        print_success "SSL certificates found"

        # Check certificate validity
        local expiry=$(openssl x509 -enddate -noout -in "$SSL_CERT" 2>/dev/null | cut -d= -f2)
        if [ ! -z "$expiry" ]; then
            print_info "Certificate expires: ${expiry}"
        fi
    else
        print_warning "SSL certificates not found"
        print_info "Generating self-signed certificate..."

        # Generate certificate
        if [ -f "scripts/generate-cert.sh" ]; then
            bash scripts/generate-cert.sh
            print_success "Self-signed certificate generated"
        else
            print_error "Certificate generation script not found"
            exit 1
        fi
    fi
    echo ""
}

# Install dependencies
install_dependencies() {
    print_header "${PACKAGE} Installing Dependencies"

    if [ -d "node_modules" ]; then
        print_info "Dependencies already installed (node_modules exists)"
        read -p "$(print_color $YELLOW '   Reinstall dependencies? (y/N): ')" reinstall
        if [[ ! $reinstall =~ ^[Yy]$ ]]; then
            echo ""
            return
        fi
    fi

    print_step "${GEAR}" "Running npm install..."
    echo ""

    npm install > /dev/null 2>&1 &
    spinner $! "Installing packages"
    wait $!

    print_success "Dependencies installed successfully"
    echo ""
}

# Build application
build_application() {
    print_header "${FIRE} Building Application"

    if [ -d "$BUILD_DIR" ]; then
        print_info "Cleaning previous build..."
        rm -rf "$BUILD_DIR"
    fi

    print_step "${GEAR}" "Building production bundle..."
    echo ""

    npm run build > build.log 2>&1 &
    local build_pid=$!

    spinner $build_pid "Compiling TypeScript and bundling assets"
    wait $build_pid
    local build_status=$?

    echo ""

    if [ $build_status -eq 0 ]; then
        print_success "Build completed successfully"

        # Show build stats
        if [ -d "$BUILD_DIR" ]; then
            local build_size=$(du -sh "$BUILD_DIR" | cut -f1)
            local file_count=$(find "$BUILD_DIR" -type f | wc -l)
            print_info "Build size: ${build_size} (${file_count} files)"
        fi
    else
        print_error "Build failed! Check build.log for details"
        tail -20 build.log
        exit 1
    fi
    echo ""
}

# Display launch options
show_launch_menu() {
    print_header "${ROCKET} Launch Options"

    print_color "$WHITE" "${BOLD}Choose a launch mode:${RESET}"
    echo ""
    print_color "$GREEN" "  1) ${BOLD}Production HTTPS${RESET} ${GRAY}(Port 8443, recommended)${RESET}"
    print_color "$BLUE" "  2) ${BOLD}Production HTTPS on Port 443${RESET} ${GRAY}(Requires sudo)${RESET}"
    print_color "$YELLOW" "  3) ${BOLD}Custom Port${RESET} ${GRAY}(Specify your own port)${RESET}"
    print_color "$CYAN" "  4) ${BOLD}Development Mode${RESET} ${GRAY}(Vite dev server with HMR)${RESET}"
    print_color "$MAGENTA" "  5) ${BOLD}Build Only${RESET} ${GRAY}(Don't start server)${RESET}"
    print_color "$RED" "  6) ${BOLD}Exit${RESET}"
    echo ""
}

# Launch server
launch_server() {
    local mode=$1
    local port=${2:-$DEFAULT_PORT}

    print_header "${ROCKET} Launching Server"

    case $mode in
        "prod")
            print_step "${LIGHTNING}" "Starting production HTTPS server on port ${port}..."
            echo ""
            # NeXuS Web Server — portable pure-Python stdlib host (no node/npm). Shared tool,
            # own repo: ~/museum/nexus-web-server.fossil (checkout ~/Projects/nexus-web-server).
            # Serves this app's dist/ and injects keys server-side from ~/.config/nexus/secrets/nexus.env.
            # Legacy node server kept as server-production.js (fallback: node server-production.js).
            python3 "$NEXUS_WEB_SERVER" --root "$BUILD_DIR" --cert "$SSL_CERT" --key "$SSL_KEY" --port $port
            ;;
        "prod-443")
            print_step "${LIGHTNING}" "Starting production HTTPS server on port 443..."
            print_warning "This requires sudo privileges"
            echo ""
            sudo python3 "$NEXUS_WEB_SERVER" --root "$BUILD_DIR" --cert "$SSL_CERT" --key "$SSL_KEY" --port 443
            ;;
        "dev")
            print_step "${LIGHTNING}" "Starting development server with hot reload..."
            echo ""
            npm run dev
            ;;
        "build-only")
            print_success "Build complete! Start server manually with: npm run prod"
            ;;
        *)
            print_error "Invalid mode"
            exit 1
            ;;
    esac
}

# Show success message
show_success() {
    local port=$1

    echo ""
    print_color "$GREEN" "╔════════════════════════════════════════════════════════════════════════╗"
    print_color "$GREEN" "║                                                                        ║"
    print_color "$GREEN" "║  ${BOLD}${SPARKLES}  SERVER LAUNCHED SUCCESSFULLY!  ${SPARKLES}${RESET}${GREEN}                              ║"
    print_color "$GREEN" "║                                                                        ║"
    print_color "$GREEN" "╚════════════════════════════════════════════════════════════════════════╝"
    echo ""
    print_color "$WHITE" "${BOLD}${GLOBE}  Access your application:${RESET}"
    echo ""
    print_color "$CYAN" "   Local:    ${BOLD}https://localhost:${port}${RESET}"
    print_color "$CYAN" "   Network:  ${BOLD}https://$(hostname -I | awk '{print $1}'):${port}${RESET}"
    echo ""
    print_color "$GRAY" "${DIM}   Note: You may need to accept the self-signed certificate${RESET}"
    echo ""
    print_color "$WHITE" "${BOLD}${SHIELD}  Features enabled:${RESET}"
    print_color "$GREEN" "   ${CHECK_MARK} TLS/SSL Encryption"
    print_color "$GREEN" "   ${CHECK_MARK} Security Headers"
    print_color "$GREEN" "   ${CHECK_MARK} HTTP → HTTPS Redirect"
    print_color "$GREEN" "   ${CHECK_MARK} Content Security Policy"
    print_color "$GREEN" "   ${CHECK_MARK} SPA Routing Support"
    echo ""
    print_color "$YELLOW" "${BOLD}${STAR}  Press Ctrl+C to stop the server${RESET}"
    echo ""
}

# Cleanup on exit
cleanup() {
    echo ""
    print_header "${GEAR} Shutting Down"
    print_info "Cleaning up..."
    print_success "Server stopped gracefully"
    echo ""
    print_color "$MAGENTA" "${SPARKLES} Thank you for using ${PROJECT_NAME}! ${SPARKLES}"
    echo ""
    exit 0
}

trap cleanup SIGINT SIGTERM

################################################################################
# Main Execution
################################################################################

main() {
    # Print banner
    print_banner

    # Parse command line arguments
    local skip_checks=false
    local auto_launch=false
    local launch_mode="prod"
    local custom_port=$DEFAULT_PORT

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-checks)
                skip_checks=true
                shift
                ;;
            --auto)
                auto_launch=true
                shift
                ;;
            --dev)
                launch_mode="dev"
                shift
                ;;
            --port)
                custom_port="$2"
                shift 2
                ;;
            --443)
                launch_mode="prod-443"
                shift
                ;;
            --build-only)
                launch_mode="build-only"
                shift
                ;;
            --help|-h)
                print_color "$WHITE" "${BOLD}Usage:${RESET} $0 [OPTIONS]"
                echo ""
                print_color "$CYAN" "Options:"
                print_color "$WHITE" "  --skip-checks    Skip system requirements check"
                print_color "$WHITE" "  --auto           Auto-launch without menu"
                print_color "$WHITE" "  --dev            Launch in development mode"
                print_color "$WHITE" "  --port <PORT>    Use custom port"
                print_color "$WHITE" "  --443            Launch on port 443 (requires sudo)"
                print_color "$WHITE" "  --build-only     Build without starting server"
                print_color "$WHITE" "  --help, -h       Show this help message"
                echo ""
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                print_info "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Run checks
    if [ "$skip_checks" = false ]; then
        check_requirements
        check_ssl_certificates
        install_dependencies
    fi

    # Build application
    build_application

    # Launch menu or auto-launch
    if [ "$auto_launch" = true ]; then
        show_success $custom_port
        launch_server $launch_mode $custom_port
    else
        while true; do
            show_launch_menu
            read -p "$(print_color $CYAN 'Select option [1-6]: ')" choice

            case $choice in
                1)
                    show_success $DEFAULT_PORT
                    launch_server "prod" $DEFAULT_PORT
                    break
                    ;;
                2)
                    show_success 443
                    launch_server "prod-443"
                    break
                    ;;
                3)
                    read -p "$(print_color $YELLOW 'Enter port number: ')" custom_port
                    if [[ $custom_port =~ ^[0-9]+$ ]] && [ $custom_port -ge 1 ] && [ $custom_port -le 65535 ]; then
                        show_success $custom_port
                        launch_server "prod" $custom_port
                        break
                    else
                        print_error "Invalid port number"
                    fi
                    ;;
                4)
                    show_success 5173
                    launch_server "dev"
                    break
                    ;;
                5)
                    launch_server "build-only"
                    cleanup
                    ;;
                6)
                    print_color "$MAGENTA" "${SPARKLES} Goodbye! ${SPARKLES}"
                    echo ""
                    exit 0
                    ;;
                *)
                    print_error "Invalid option. Please choose 1-6."
                    sleep 2
                    ;;
            esac
        done
    fi
}

# Run main function
main "$@"
