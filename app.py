
import mimetypes
from flask import Flask, render_template,request,redirect,send_file
from hackingtools import get_own_ip, lan_scan,port_scan,get_own_ip,arp_poisoning,get_broadcastaddr
import pandas as pd
import webbrowser
import os
from scapy.all import *


app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def show():
    ip = get_own_ip()
    broadcast=get_broadcastaddr()
    return render_template('index.html',ip=ip,broadcast=broadcast)

@app.route('/lanscan',methods = ['GET','POST'])
def flask_lanscan():
    if request.method == 'GET':
        return render_template('lanscan.html')
    try:
        if request.method == 'POST':
            web_input=request.form.get('web_input')
            start,end=web_input.split(',')
            lanscan_result = lan_scan(start,end)
        
            return render_template('lanscan.html'),webbrowser.open_new_tab('http://127.0.0.1:5000/lanscan_result')
    except:
        return render_template('lanscan.html')
    
@app.route('/lanscan_result')
def result():
    return render_template('result.html')

@app.route('/portscan',methods=['GET','POST'])
def flask_portscan():
    if request.method == 'GET':
        return render_template('portscan.html')
    if request.method == 'POST':
        web_input = request.form.get('web_input')
        ip,port,port_end = web_input.split(',')
        

        
        
        result = port_scan(ip,port,port_end)
        return render_template('portscan.html',result = result)
    
@app.route('/binary',methods=['POST','GET'])
def flask_binary():
    if request.method == 'GET':
        return render_template('binary.html')
    if request.method == 'POST':
        file = request.files['file']
        file.save(os.path.join('./file/',file.filename))
        file = './file/'+ file.filename
        with open(file,'rb') as f:
            binary=f.read()
            result=binary.decode('utf-8',errors='ignore')


        return render_template('binary.html',result=result,binary=binary)
    
@app.route('/arp_spoofing',methods=['POST','GET'])
def spoofing():
    if request.method=='GET':
        return render_template('arp_spoofing.html')
    if request.method == 'POST':
        web_input = request.form.get('web_input')
        target_ip,gateway_ip,packet_count=web_input.split(':')
        arp_poisoning(target_ip,gateway_ip,packet_count)
        
        
        return render_template('arp_spoofing.html')


@app.route('/ctf',methods=['GET'])
def ctf():
    return render_template('ctf.html')

@app.route('/send_packet',methods=['GET','POST'])
def send_packet():
    p=request.form.get('radio')
    
    if p==1:
        a=a
    
    
    return render_template('send_packet.html')
    
    
if __name__ == '__main__':
    app.run(port=5000, debug=True)
    
    