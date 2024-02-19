import mimetypes
import os
import webbrowser

import pandas as pd
from flask import Flask, redirect, render_template, request, send_file
from scapy.all import *

from hackingtools import (arp_poisoning, get_broadcastaddr, get_own_ip,
                          lan_scan, port_scan)

app = Flask(__name__, static_folder=".", static_url_path="")


@app.route("/")
def show():
    ip = get_own_ip()
    broadcast = get_broadcastaddr()
    return render_template("index.html", ip=ip, broadcast=broadcast)


@app.route("/lanscan", methods=["GET", "POST"])
def flask_lanscan():
    if request.method == "GET":
        ip = get_own_ip()
        broadcast = get_broadcastaddr()
        return render_template("lanscan.html", ip=ip, broadcast=broadcast)
    try:
        if request.method == "POST":
            ip = get_own_ip()
            broadcast = get_broadcastaddr()
            web_input = request.form.get("web_input")
            start, end = web_input.split(",")
            lan_scan(start, end)

            return render_template(
                "lanscan.html", ip=ip, broadcast=broadcast
            ), webbrowser.open_new_tab("http://127.0.0.1:5000/lanscan_result")
    except:
        return render_template("lanscan.html")


@app.route("/lanscan_result")
def result():
    return render_template("result.html")


@app.route("/portscan", methods=["GET", "POST"])
def flask_portscan():
    if request.method == "GET":
        return render_template("portscan.html")
    if request.method == "POST":
        web_input = request.form.get("web_input")
        ip, port, port_end = web_input.split(",")

        result = port_scan(ip, port, port_end)
        return render_template("portscan.html", result=result)


@app.route("/binary", methods=["POST", "GET"])
def flask_binary():
    if request.method == "GET":
        return render_template("binary.html")
    if request.method == "POST":
        file = request.files["file"]
        file.save(os.path.join("./file/", file.filename))
        file = "./file/" + file.filename
        with open(file, "rb") as f:
            binary = f.read()
            result = binary.decode("utf-8", errors="ignore")

        return render_template("binary.html", result=result, binary=binary)


@app.route("/arp_spoofing", methods=["POST", "GET"])
def spoofing():
    if request.method == "GET":
        return render_template("arp_spoofing.html")
    if request.method == "POST":
        web_input = request.form.get("web_input")
        target_ip, gateway_ip, packet_count = web_input.split(":")
        arp_poisoning(target_ip, gateway_ip, packet_count)

        return render_template("arp_spoofing.html")


@app.route("/ctf", methods=["GET"])
def ctf():
    return render_template("ctf.html")


if __name__ == "__main__":
    app.run(port=8000, debug=True)
