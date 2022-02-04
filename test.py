from scapy.all import *

def get_addr(network_part,start,end):
    # ICMPパケットを流して結果を1つだけ受け取る dstの後をブロードキャストアドレスにしたいところ
    # ネットワーク部だけ入力してもらって，後は繰り返す？ 192.168.1.0~192.168.1.254みたいに．
    #broadcast_ipaddr = 
    receives_ICMP = []
    receives_ARP = []
    ip_addr_list = []
    print(start)
    start=int(start)
    end=int(end)
    
    for i in range (start,end+1):
        i = str(i)
        dst_addr = network_part + i
        ip_addr_list.append(dst_addr)
        
        print('現在探索中のアドレスは{}'.format(dst_addr))
        
        
        frame = Ether(dst='ff:ff:ff:ff:ff:ff') / ARP(op=1, pdst = dst_addr)
        receive = srp(frame,timeout=1,iface='en0')
        try:
            receives_ARP.append(receive[Ether].src)
        except:
            receives_ARP.append(receive)
    return ip_addr_list,receives_ARP

print(get_addr('192.168.1.',254,255))