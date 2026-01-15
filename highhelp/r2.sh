# 1. First, download from R2 to a temp folder using the AWS CLI
aws s3 sync s3://highhelp-storage ~/Desktop/r2-temp-dump --endpoint-url https://19424bae4d09fc4c6686893983b57494.r2.cloudflarestorage.com --profile cloudflare

# 2. Ingest them into Wrangler's local state
cd ~/Desktop/r2-temp-dump
find . -type f | while read file; do
  # Remove the leading './' from the filename to get the R2 Key
  KEY="${file#./}"
  npx wrangler r2 object put highhelp-storage/"$KEY" --file="$file" --local
done