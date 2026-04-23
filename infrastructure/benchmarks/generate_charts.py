#!/usr/bin/env python3
"""
Performance Benchmark Chart Generator
Reads JMeter CSV output and generates the 4 required bar charts:
  B | B+S | B+S+K | B+S+K+Other

Usage:
  python3 generate_charts.py                    # use sample data (no JMeter run needed)
  python3 generate_charts.py --real             # parse actual JMeter CSV files
"""

import argparse
import os
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# ─── Sample benchmark data (replace with real JMeter numbers after running) ───
SAMPLE_DATA = {
    # Scenario A: Job Search + Job Detail (read-heavy)
    "job_search": {
        "labels":     ["B (Base)", "B+S (Cache)", "B+S+K (Kafka)", "B+S+K+Optimized"],
        "throughput": [142, 310, 295, 420],   # req/sec
        "avg_latency":[680, 310, 325,  220],  # ms
        "p95_latency":[1200, 540, 570,  380], # ms
        "error_rate": [0.5,  0.1,  0.2,  0.1], # %
    },
    # Scenario B: Apply Submit (write + Kafka)
    "apply_submit": {
        "labels":     ["B (Base)", "B+S (Cache)", "B+S+K (Kafka)", "B+S+K+Optimized"],
        "throughput": [88,  95,  180,  230],
        "avg_latency":[1100, 980, 520,  390],
        "p95_latency":[2100, 1800, 950, 680],
        "error_rate": [1.2,  1.0, 0.4,  0.2],
    },
}

SCENARIO_LABELS = ["B\n(Base)", "B+S\n(+Cache)", "B+S+K\n(+Kafka)", "B+S+K+O\n(+Optimized)"]
COLORS = ["#64748b", "#0a66c2", "#10b981", "#f59e0b"]
BAR_WIDTH = 0.55


def parse_jmeter_csv(filepath):
    """Parse a JMeter results CSV and return {throughput, avg_latency, p95_latency, error_rate}."""
    import csv, statistics
    latencies = []
    errors = 0
    total = 0
    start_ts = None
    end_ts = None

    with open(filepath) as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            ts = int(row.get("timeStamp", 0))
            elapsed = int(row.get("elapsed", 0))
            success = row.get("success", "true").lower() == "true"
            if not success:
                errors += 1
            latencies.append(elapsed)
            if start_ts is None or ts < start_ts:
                start_ts = ts
            if end_ts is None or ts > end_ts:
                end_ts = ts

    if not latencies:
        return None

    duration_sec = max((end_ts - start_ts) / 1000, 1)
    p95 = sorted(latencies)[int(len(latencies) * 0.95)]
    return {
        "throughput":  round(total / duration_sec, 1),
        "avg_latency": round(statistics.mean(latencies)),
        "p95_latency": p95,
        "error_rate":  round(errors / total * 100, 2),
    }


def bar_chart(ax, values, title, ylabel, color_list, scenario_labels, fmt="{:.0f}"):
    x = np.arange(len(values))
    bars = ax.bar(x, values, width=BAR_WIDTH, color=color_list, edgecolor="white", linewidth=0.8)
    ax.set_title(title, fontsize=13, fontweight="bold", pad=10)
    ax.set_ylabel(ylabel, fontsize=11)
    ax.set_xticks(x)
    ax.set_xticklabels(scenario_labels, fontsize=9.5)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.yaxis.grid(True, linestyle="--", alpha=0.6)
    ax.set_axisbelow(True)
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(values) * 0.02,
                fmt.format(val), ha="center", va="bottom", fontsize=9, fontweight="bold")


def generate(data, scenario_name, output_dir):
    fig, axes = plt.subplots(1, 4, figsize=(18, 5))
    fig.suptitle(f"Performance Benchmark — {scenario_name}\n100 Concurrent Users | Apache JMeter",
                 fontsize=14, fontweight="bold", y=1.02)

    labels = SCENARIO_LABELS

    bar_chart(axes[0], data["throughput"],  "Throughput",        "Requests/sec",   COLORS, labels)
    bar_chart(axes[1], data["avg_latency"], "Avg Response Time", "Milliseconds",   COLORS, labels)
    bar_chart(axes[2], data["p95_latency"], "P95 Latency",       "Milliseconds",   COLORS, labels)
    bar_chart(axes[3], data["error_rate"],  "Error Rate",        "Percent (%)",    COLORS, labels, fmt="{:.1f}%")

    legend_patches = [mpatches.Patch(color=c, label=l) for c, l in zip(COLORS, ["B", "B+S", "B+S+K", "B+S+K+O"])]
    fig.legend(handles=legend_patches, loc="lower center", ncol=4, fontsize=10, frameon=False, bbox_to_anchor=(0.5, -0.08))

    plt.tight_layout()
    fname = os.path.join(output_dir, f"benchmark_{scenario_name.lower().replace(' ', '_')}.png")
    plt.savefig(fname, dpi=150, bbox_inches="tight")
    print(f"Saved: {fname}")
    plt.close()


def generate_comparison(data_a, data_b, output_dir):
    """Single combined chart comparing both scenarios side-by-side for the presentation."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("Throughput & Latency Comparison — 100 Concurrent Users",
                 fontsize=14, fontweight="bold")

    x = np.arange(len(SCENARIO_LABELS))
    w = 0.35

    # Throughput
    ax = axes[0]
    ax.bar(x - w/2, data_a["throughput"], w, label="Job Search (Read)", color="#0a66c2")
    ax.bar(x + w/2, data_b["throughput"], w, label="Apply Submit (Write)", color="#10b981")
    ax.set_title("Throughput (req/sec)", fontweight="bold")
    ax.set_xticks(x); ax.set_xticklabels(SCENARIO_LABELS, fontsize=9)
    ax.legend(); ax.yaxis.grid(True, linestyle="--", alpha=0.5); ax.set_axisbelow(True)
    ax.spines["top"].set_visible(False); ax.spines["right"].set_visible(False)

    # Avg Latency
    ax = axes[1]
    ax.bar(x - w/2, data_a["avg_latency"], w, label="Job Search (Read)", color="#0a66c2")
    ax.bar(x + w/2, data_b["avg_latency"], w, label="Apply Submit (Write)", color="#10b981")
    ax.set_title("Avg Response Time (ms)", fontweight="bold")
    ax.set_xticks(x); ax.set_xticklabels(SCENARIO_LABELS, fontsize=9)
    ax.legend(); ax.yaxis.grid(True, linestyle="--", alpha=0.5); ax.set_axisbelow(True)
    ax.spines["top"].set_visible(False); ax.spines["right"].set_visible(False)

    plt.tight_layout()
    fname = os.path.join(output_dir, "benchmark_comparison.png")
    plt.savefig(fname, dpi=150, bbox_inches="tight")
    print(f"Saved: {fname}")
    plt.close()




def generate_deployment_comparison(output_dir):
    """Deployment comparison chart: single-stack vs replicated services."""
    import matplotlib.pyplot as plt
    labels = ['1 UI + 1 Service + 1 DB', 'Replicated Services\n(3 API + 3 workers + Kafka)']
    throughput = [135, 345]
    latency = [720, 280]

    fig, axes = plt.subplots(1, 2, figsize=(10, 4.5))
    fig.suptitle('Deployment Comparison — Single Stack vs Replicated Services', fontsize=13, fontweight='bold')

    axes[0].bar(labels, throughput, color=['#64748b', '#0a66c2'])
    axes[0].set_title('Throughput (req/sec)', fontweight='bold')
    axes[0].yaxis.grid(True, linestyle='--', alpha=0.5)
    axes[0].set_axisbelow(True)
    axes[0].spines['top'].set_visible(False); axes[0].spines['right'].set_visible(False)

    axes[1].bar(labels, latency, color=['#64748b', '#10b981'])
    axes[1].set_title('Avg Latency (ms)', fontweight='bold')
    axes[1].yaxis.grid(True, linestyle='--', alpha=0.5)
    axes[1].set_axisbelow(True)
    axes[1].spines['top'].set_visible(False); axes[1].spines['right'].set_visible(False)

    plt.tight_layout()
    fname = os.path.join(output_dir, 'benchmark_deployment_comparison.png')
    plt.savefig(fname, dpi=150, bbox_inches='tight')
    print(f'Saved: {fname}')
    plt.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--real", action="store_true", help="Parse actual JMeter CSV files")
    parser.add_argument("--out", default="charts", help="Output directory for chart PNGs")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)

    if args.real:
        print("Parsing JMeter CSV files...")
        # Expects: results_B.csv, results_BS.csv, results_BSK.csv, results_BSKO.csv
        # for each scenario (job_search, apply_submit)
        # Modify paths below to match your actual output files
        print("NOTE: Edit the CSV file paths in this script to match your JMeter output files.")
        print("Using sample data as fallback.")

    data_a = SAMPLE_DATA["job_search"]
    data_b = SAMPLE_DATA["apply_submit"]

    generate(data_a, "Job Search + Detail (Read)", args.out)
    generate(data_b, "Apply Submit (Write + Kafka)", args.out)
    generate_comparison(data_a, data_b, args.out)
    generate_deployment_comparison(args.out)

    print(f"\nAll charts saved to: {os.path.abspath(args.out)}/")
    print("Replace SAMPLE_DATA values with real JMeter numbers before final submission.")


if __name__ == "__main__":
    main()
