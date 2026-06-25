#!/bin/bash
# Watchdog: restarts `next dev` if it dies
cd /home/z/my-project
while true; do
  if ! pgrep -f "next dev -p 3000" > /dev/null; then
    echo "[$(date)] (re)starting dev server..." >> /home/z/my-project/dev-watchdog.log
    node --max-old-space-size=1536 node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    DEV_PID=$!
    echo "[$(date)] dev PID=$DEV_PID" >> /home/z/my-project/dev-watchdog.log
    # Wait for it to be ready or die
    for i in $(seq 1 30); do
      sleep 1
      if ! kill -0 $DEV_PID 2>/dev/null; then
        echo "[$(date)] dev died during startup" >> /home/z/my-project/dev-watchdog.log
        break
      fi
      if grep -q "Ready in" /home/z/my-project/dev.log 2>/dev/null; then
        echo "[$(date)] dev ready" >> /home/z/my-project/dev-watchdog.log
        break
      fi
    done
  fi
  sleep 5
done
