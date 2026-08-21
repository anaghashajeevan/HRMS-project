import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
api_key = os.getenv('GROQ_API_KEY')

if not api_key:
    print("❌ GROQ_API_KEY not found in .env file!")
else:
    client = Groq(api_key=api_key)
    try:
        models = client.models.list()
        print("\n✅ Accessible Groq Models for your API key:\n" + "=" * 45)
        for model in models.data:
            print(f" • {model.id}")
        print("=" * 45)
    except Exception as e:
        print(f"❌ Error fetching models: {e}")