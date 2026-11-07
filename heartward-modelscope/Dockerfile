FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10
WORKDIR /home/user/app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 HOST=0.0.0.0 PORT=7860
COPY backend/ ./backend/
COPY web/ ./web/
COPY ["解忧漫游_原型的世界/", "./解忧漫游_原型的世界/"]
COPY app.py ./app.py
EXPOSE 7860
ENTRYPOINT ["python", "-u", "app.py"]
