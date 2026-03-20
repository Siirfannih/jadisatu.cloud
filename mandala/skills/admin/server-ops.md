# Skill: Server Operations

Monitoring dan management VPS. Hanya tersedia di CEO Mode.

## Server Info

- IP: 76.13.190.196
- SSH: root@76.13.190.196 -p 2222
- OS: Ubuntu 25.10

## Services

| Service | Port | Manager |
|---|---|---|
| jadisatu-nextjs | 3000 | PM2 |
| hunter-agent | 8000 | PM2 |
| visual-engine | 8100 | PM2 |
| mandala-engine | TBD | PM2 |

## Tanpa Konfirmasi (Boleh Langsung)

- Cek status: `systemctl status`, `pm2 status`
- Lihat log: `journalctl`, `pm2 logs`
- Cek resource: `df -h`, `free -h`, `uptime`
- Cek firewall: `ufw status`
- Cek GitHub: `gh repo list`, `gh issue list`

## Wajib Konfirmasi Owner

- Restart service apapun
- Buat/hapus service baru
- Ubah config server
- Reboot server

## Dilarang

- rm -rf atau delete file penting
- Ubah SSH config atau authorized_keys
- Buka port baru di firewall
- Share credential
