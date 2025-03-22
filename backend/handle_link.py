from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, CouldNotRetrieveTranscript
import re

def extract_video_id(url):
    """Extracts the YouTube video ID from various URL formats."""
    patterns = [
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})",
        r"youtube\.com/live/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/embed/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/v/([a-zA-Z0-9_-]{11})"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)  # Extracted Video ID
    
    return None  # No valid video ID found

def get_youtube_captions(video_url):
    video_id = extract_video_id(video_url)
    if not video_id:
        return {"status": "error", "message": "Invalid YouTube URL!"}
    
    try:
        # Get available transcripts
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        
        # Try to get English transcript
        try:
            transcript = transcript_list.find_transcript(['en'])  # English
        except NoTranscriptFound:
            # If no English, try Hindi auto-generated and translate it to English
            transcript = transcript_list.find_transcript(['hi']).translate('en')
        
        captions = "\n".join([snippet.text for snippet in transcript.fetch()])
        return {"status": "success", "transcript": captions}
    
    except TranscriptsDisabled:
        return {"status": "error", "message": "Transcripts are disabled for this video!"}
    except CouldNotRetrieveTranscript:
        return {"status": "error", "message": "Could not retrieve the transcript!"}
    except NoTranscriptFound:
        return {"status": "error", "message": "No transcripts available!"}
    except Exception as e:
        return {"status": "error", "message": f"Error: {str(e)}"}
    
if __name__=="__main__":
    pass