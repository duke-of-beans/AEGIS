# AEGIS

A Windows resource manager built for high-throughput AI-assisted development: CPU, IO, memory, and power optimization across five canonical operating profiles.

## The problem

Running multiple AI coding sessions, a browser with dozens of tabs, and background build/index processes at once turns a normal desktop into a resource-contention problem that generic Windows power settings don't solve. The wrong profile for the moment — full performance during a research read, or throttled during a compile — costs real time either way.

## What it does

AEGIS switches between five defined operating profiles based on what's actually happening on the machine, trading off CPU/IO/memory/power allocation to match the current workload rather than running one static configuration all the time.

## Part of a system

AEGIS is the resource-management layer supporting a larger cognitive-infrastructure stack. See [davidkirsch.me/builds](https://davidkirsch.me/builds) for the rest.
