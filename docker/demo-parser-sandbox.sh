#!/bin/sh
# Sandbox wrapper of the demo parser (worker image). The worker starts the parser through this
# script with an already scrubbed environment; it applies per-process resource limits and runs
# the binary with an empty environment except for the Go runtime limits below.
#
# Limits (per parser process, on top of the worker container's cgroup limits):
#   -v  address space 4 GiB  (the Go heap is soft-capped at 1 GiB by GOMEMLIMIT and
#                             debug.SetMemoryLimit; peak RSS measured at ~160 MB for a 218 MB demo)
#   -t  CPU time 3600 s      (the worker's wall-clock deadline is at most 30 min)
#   -f  file size 512 MiB    (normalized output is capped at 480 MiB; replay artifacts are smaller)
#   -n  64 open files
#   -c  no core dumps        (a crash must not write demo-derived memory to disk)
set -eu
ulimit -v 4194304
ulimit -t 3600
ulimit -f 1048576
ulimit -n 64
ulimit -c 0
exec env -i PATH=/usr/bin:/bin GOMEMLIMIT=1GiB GOMAXPROCS=2 GOTRACEBACK=none \
  /usr/local/bin/demo-parser "$@"
