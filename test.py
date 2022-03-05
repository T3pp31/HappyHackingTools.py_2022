import netifaces
from scapy.all import *

def get_broadcastaddr():
    broadcastaddr=netifaces.ifaddresses('en0')[netifaces.AF_INET][0]['broadcast']
    return broadcastaddr
    
def get_own_ip():
    ip = netifaces.ifaddresses('en0')[netifaces.AF_INET][0]['addr']
    return ip

if __name__=='__main__':
    print(netifaces.ifaddresses('en0')[netifaces.AF_INET][0])