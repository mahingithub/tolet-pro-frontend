import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const VideoModal = ({ isOpen, onClose, videoUrl, title }) => {
	// Prevent body scroll when modal is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = 'unset';
		}
		return () => {
			document.body.style.overflow = 'unset';
		};
	}, [isOpen]);

	if (!isOpen || !videoUrl) return null;

	// Extract YouTube video ID if it's a YouTube link to use the embed format
	const getEmbedUrl = (url) => {
		try {
			let videoId = '';
			if (url.includes('youtube.com/watch')) {
				const urlObj = new URL(url);
				videoId = urlObj.searchParams.get('v');
			} else if (url.includes('youtu.be/')) {
				videoId = url.split('youtu.be/')[1].split('?')[0];
			}

			if (videoId) {
				return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
			}
			return url;
		} catch (error) {
			return url;
		}
	};

	const embedUrl = getEmbedUrl(videoUrl);
	const isYouTube = embedUrl.includes('youtube.com/embed');

	return (
		<div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 p-4">
			<div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300">
				
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
					<h3 className="font-black text-gray-900 truncate pr-4 text-lg">
						{title || 'Help Guide'}
					</h3>
					<button
						onClick={onClose}
						className="p-2 bg-gray-100 hover:bg-[#ba0036] hover:text-white rounded-full transition-colors flex-shrink-0"
						aria-label="Close video"
					>
						<X size={20} />
					</button>
				</div>

				{/* Video Container */}
				<div className="relative w-full aspect-video bg-black shrink-0">
					{isYouTube ? (
						<iframe
							src={embedUrl}
							title={title || 'Video Player'}
							className="absolute top-0 left-0 w-full h-full"
							frameBorder="0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
						></iframe>
					) : (
						<video
							src={embedUrl}
							controls
							autoPlay
							className="w-full h-full"
						>
							Your browser does not support the video tag.
						</video>
					)}
				</div>
			</div>
		</div>
	);
};

export default VideoModal;
