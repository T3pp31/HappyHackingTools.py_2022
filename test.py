import netifaces

def get_broadcastaddr():
    broadcastaddr=netifaces.ifaddresses('en0')[netifaces.AF_INET][0]['broadcast']
    return broadcastaddr
    
def get_own_ip():
    ip = netifaces.ifaddresses('en0')[netifaces.AF_INET][0]['addr']
    return ip

if __name__=='__main__':
    print(get_broadcastaddr())
    
#broadcastアドレスを計算で求め，ブロードキャストにICMPを投げることでIPMACなどを取得する予定