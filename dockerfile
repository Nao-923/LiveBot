FROM node:22

# 作業ディレクトリを作成
WORKDIR /app

# package.json と lock をコピーして依存関係をインストール
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npx tsc

# アプリ起動（ここで dist/index.js を実行）
CMD ["node", "dist/index.js"]