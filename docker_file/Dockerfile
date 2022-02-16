FROM python:3.9.7
USER root

RUN apt-get update
RUN apt-get -y install locales && localedef -f UTF-8 -i ja_JP ja_JP.UTF-8

ENV LANG ja_JP.UTF-8
ENV LANGUAGE ja_JP:ja
ENV LC_ALL ja_JP.UTF-8
ENV TZ JST-9
ENV TERM xterm

RUN apt-get install -y vim
RUN pip install --upgrade pip
RUN pip install --upgrade setuptools
RUN git clone https://github.com/Fu-Te/HappyHackingTools.py_2022.git
RUN pip install flask scapy netifaces pandas tqdm

EXPOSE 5000