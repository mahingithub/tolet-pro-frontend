const fs = require('fs');
let code = fs.readFileSync('src/components/PropertyListing.jsx', 'utf8');

// Remove the badge from the top-3 left-3 container
code = code.replace(
`                        <div className="absolute top-3 left-3 flex flex-col gap-2 items-start">
                            {property.availabilityStatus === 'rented' && (
                                <div className="absolute inset-0 z-10 bg-brandRed/80 backdrop-blur-[2px] flex items-center justify-center">
                                    <div className="bg-white px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xl text-sm font-black text-brandRed transform -rotate-12 border-2 border-brandRed/20">
                                        {t.rentedBadge || "ভাড়া হয়ে গেছে"}
                                    </div>
                                </div>
                            )}`,
`                        <div className="absolute top-3 left-3 flex flex-col gap-2 items-start">`
);

// Add the badge to the image container
code = code.replace(
`						{coverImg ? (
							<img src={coverImg} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" loading="lazy" decoding="async" />
						) : (
							<div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-100">
								<Camera size={42} />
							</div>
						)}`,
`						{coverImg ? (
							<img src={coverImg} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" loading="lazy" decoding="async" />
						) : (
							<div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-100">
								<Camera size={42} />
							</div>
						)}
                        {property.availabilityStatus === 'rented' && (
                            <div className="absolute inset-0 z-10 bg-brandRed/70 backdrop-blur-sm flex items-center justify-center">
                                <div className="bg-white px-4 py-2 rounded-xl shadow-xl text-sm font-black text-brandRed transform -rotate-12 border-2 border-white/50">
                                    {t.rentedBadge || "ভাড়া হয়ে গেছে"}
                                </div>
                            </div>
                        )}`
);

fs.writeFileSync('src/components/PropertyListing.jsx', code);
