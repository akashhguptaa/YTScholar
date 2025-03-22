import os
from dotenv import load_dotenv
from google import genai
import re

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

def get_summary(transcription):
    """
    Generate a summary of the transcription using Google's Gemini model.
    
    Args:
        transcription (str): The transcription text to summarize
        
    Returns:
        str: The generated summary
    """
    prompt = f"""
    Summarize the following YouTube video transcript in a concise way. 
    Include the main topics discussed, key points, and important takeaways.
    Format the summary with clear sections and bullet points where appropriate.
    
    TRANSCRIPT:
    {transcription}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return response.text
    except Exception as e:
        return f"Error generating summary: {str(e)}"

if __name__ == "__main__":
    test_transcript = "This is a test transcript for a video about machine learning."
    print(get_summary(test_transcript))