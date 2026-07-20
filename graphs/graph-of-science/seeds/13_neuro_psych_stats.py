"""Neuroscience, psychology, statistics extras. Target ~200 nodes."""

from _helpers import S


def W(name):
    return [{"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"}]


SCIENCES = []

# ---- NEUROSCIENCE / COGNITIVE SCIENCE ----
NEURO = [
    ("Neurotransmitter", "neurotransmitter", "Chemical messenger released by neurons to relay signals across synapses.",
     ["chemical messenger"]),
    ("Synaptic Plasticity", "synaptic-plasticity", "The ability of synapses to strengthen or weaken over time in response to activity — the cellular basis of learning.",
     []),
    ("Long-Term Potentiation", "long-term-potentiation", "Persistent strengthening of synapses based on recent activity — a candidate mechanism of memory.",
     ["LTP"]),
    ("Long-Term Depression", "long-term-depression", "Persistent weakening of synapses; complementary to LTP.",
     ["LTD"]),
    ("Reflex Arc", "reflex-arc", "The neural pathway that mediates a reflex — sensor to spinal cord to effector.",
     []),
    ("Motor Cortex", "motor-cortex", "The region of the cerebral cortex responsible for planning and executing voluntary movement.",
     []),
    ("Sensory Cortex", "sensory-cortex", "The regions of the cerebral cortex processing input from the senses.",
     ["somatosensory cortex"]),
    ("Visual Cortex", "visual-cortex", "The region of the cerebral cortex processing visual information from the retina.",
     ["V1"]),
    ("Auditory Cortex", "auditory-cortex", "The region of the temporal lobe processing sound.",
     []),
    ("Broca's Area", "brocas-area", "The region of the frontal lobe critical for speech production.",
     []),
    ("Wernicke's Area", "wernickes-area", "The region of the temporal lobe critical for language comprehension.",
     []),
    ("Basal Ganglia", "basal-ganglia", "Group of subcortical nuclei involved in movement, learning, and reward.",
     []),
    ("Substantia Nigra", "substantia-nigra", "Midbrain structure containing dopaminergic neurons; degenerates in Parkinson's disease.",
     []),
    ("Neuromuscular Junction", "neuromuscular-junction", "The synapse where a motor neuron meets a muscle fiber.",
     []),
    ("Blood-Brain Barrier", "blood-brain-barrier", "The highly-selective membrane that separates circulating blood from the brain's extracellular fluid.",
     ["BBB"]),
    ("Myelin Sheath", "myelin-sheath", "The insulating layer around axons that speeds nerve conduction.",
     ["myelin"]),
    ("Ion Channel", "ion-channel", "Membrane protein forming a pore that lets specific ions pass — the substrate of neural excitability.",
     []),
    ("Sodium-Potassium Pump", "sodium-potassium-pump", "Membrane enzyme that maintains the resting membrane potential by pumping Na+ out and K+ in against gradients.",
     ["Na/K-ATPase"]),
    ("Resting Membrane Potential", "resting-membrane-potential", "The voltage difference across a neuron's membrane at rest, typically −70 mV.",
     []),
    ("Neuroplasticity", "neuroplasticity", "The brain's ability to reorganize itself by forming new neural connections throughout life.",
     ["brain plasticity"]),
    ("Working Memory", "working-memory", "The cognitive system holding information temporarily for reasoning and decision-making.",
     ["short-term memory"]),
    ("Long-Term Memory", "long-term-memory", "The relatively permanent memory system storing skills, facts, and experiences.",
     []),
    ("Episodic Memory", "episodic-memory", "Long-term memory of specific events in one's own life.",
     []),
    ("Semantic Memory", "semantic-memory", "Long-term memory of facts and general knowledge.",
     []),
    ("Procedural Memory", "procedural-memory", "Long-term memory of how to do things — motor skills, habits.",
     []),
    ("Attention", "attention", "The cognitive process of selectively focusing on some information while ignoring others.",
     []),
    ("Perception", "perception", "The organization and interpretation of sensory information to represent the environment.",
     []),
    ("Cognition", "cognition", "Mental action or process of acquiring knowledge through thought, experience, and the senses.",
     []),
    ("Executive Function", "executive-function", "Higher-order cognitive processes for controlling behavior — planning, working memory, inhibition.",
     []),
    ("Theory of Mind", "theory-of-mind", "The capacity to attribute mental states — beliefs, desires, intentions — to oneself and others.",
     ["ToM"]),
    ("Mirror Neuron", "mirror-neuron", "Neuron that fires both when performing an action and when observing the same action performed by another.",
     []),
    ("Consciousness", "consciousness", "The state of being aware of and able to think about oneself and one's environment.",
     ["subjective experience"]),
    ("Dreaming", "dreaming", "Succession of images, ideas, emotions, and sensations occurring during certain stages of sleep.",
     []),
    ("Cognitive Bias", "cognitive-bias", "A systematic pattern of deviation from norm or rationality in judgment.",
     []),
    ("Confirmation Bias", "confirmation-bias", "The tendency to search for, interpret, and recall information that confirms one's preexisting beliefs.",
     []),
    ("Availability Heuristic", "availability-heuristic", "Judging the probability of events by how easily examples come to mind.",
     []),
    ("Anchoring Effect", "anchoring-effect", "The tendency to rely too heavily on the first piece of information encountered.",
     []),
    ("Dunning-Kruger Effect", "dunning-kruger-effect", "Cognitive bias where people with low ability at a task overestimate their ability.", []),
    ("Placebo Effect", "placebo-effect", "Beneficial effect produced by a treatment that cannot be attributed to the treatment itself; reflects expectation.",
     []),
    ("Classical Conditioning", "classical-conditioning", "Learning by associating a neutral stimulus with a stimulus that naturally produces a response — Pavlov's dogs.",
     ["Pavlovian conditioning"]),
    ("Operant Conditioning", "operant-conditioning", "Learning through reinforcement and punishment — Skinner boxes.",
     ["instrumental conditioning"]),
    ("Habituation", "habituation", "The decrease in response to a stimulus after repeated exposure.",
     []),
    ("Sensitization", "sensitization", "The increase in response to a stimulus after previous exposure to a stronger stimulus.",
     []),
    ("Autonomic Response", "autonomic-response", "Involuntary physiological response controlled by the autonomic nervous system — heart rate, sweating, pupil dilation.",
     []),
    ("Fight-or-Flight", "fight-or-flight", "The physiological reaction to perceived threat, mobilizing energy resources; sympathetic activation.",
     ["fight or flight response"]),
]
for row in NEURO:
    name, slug, narr, extras = row
    disc = "cognitive-science" if slug in ("cognition", "perception", "attention", "working-memory", "long-term-memory", "episodic-memory", "semantic-memory", "procedural-memory", "executive-function", "theory-of-mind", "consciousness", "cognitive-bias", "confirmation-bias", "availability-heuristic", "anchoring-effect", "dunning-kruger-effect", "classical-conditioning", "operant-conditioning", "habituation", "sensitization") else "neuroscience"
    kind = "process" if slug.endswith("-effect") or slug in ("dreaming", "consciousness", "attention", "perception", "cognition", "classical-conditioning", "operant-conditioning", "habituation", "sensitization", "neuroplasticity", "synaptic-plasticity", "long-term-potentiation", "long-term-depression", "fight-or-flight", "autonomic-response") else \
           "structure" if slug in ("motor-cortex", "sensory-cortex", "visual-cortex", "auditory-cortex", "brocas-area", "wernickes-area", "basal-ganglia", "substantia-nigra", "neuromuscular-junction", "blood-brain-barrier", "myelin-sheath", "ion-channel", "sodium-potassium-pump", "reflex-arc") else \
           "object"
    SCIENCES.append(S(name, disc, kind,
                     id_slug=slug, extras=extras + [name.lower()], narrative=narr,
                     applies=[":biological"],
                     subsumed_by="neuroscience" if disc == "neuroscience" else "cognitive-science",
                     provenance=W(name.replace(" ", "_"))))

# ---- STATISTICS extras ----
STATS = [
    ("Mean", "arithmetic-mean", "The average of a set of numbers — sum divided by count."),
    ("Median", "median", "The middle value of a sorted list — half the values fall below, half above."),
    ("Mode", "mode", "The most-frequent value in a data set."),
    ("Range (statistics)", "range-stats", "The difference between the largest and smallest values in a data set."),
    ("Percentile", "percentile", "A value below which a given percentage of observations fall."),
    ("Quartile", "quartile", "Three points that divide a data set into four equal groups."),
    ("Interquartile Range", "iqr", "The difference between the 75th and 25th percentiles — a robust measure of spread."),
    ("Standard Score", "z-score", "The signed number of standard deviations by which a value differs from the mean."),
    ("Sample", "statistical-sample", "A subset of a population used to estimate properties of the whole."),
    ("Population (statistics)", "statistical-population", "The complete set of items about which inferences are drawn."),
    ("Sampling", "sampling-stats", "The process of selecting individuals from a population to estimate population characteristics."),
    ("Random Sampling", "random-sampling", "Sampling in which each member of the population has an equal chance of selection."),
    ("Stratified Sampling", "stratified-sampling", "Sampling in which the population is divided into strata and samples drawn from each."),
    ("Type I Error", "type-i-error", "Rejecting a true null hypothesis — a false positive."),
    ("Type II Error", "type-ii-error", "Failing to reject a false null hypothesis — a false negative."),
    ("Statistical Power", "statistical-power", "The probability that a test correctly rejects a false null hypothesis."),
    ("Null Hypothesis", "null-hypothesis", "The default hypothesis of no effect or no difference, to be tested against an alternative."),
    ("Alternative Hypothesis", "alternative-hypothesis", "The hypothesis that a real effect or difference exists, tested against the null."),
    ("Confounding Variable", "confounding-variable", "A variable that influences both the dependent and independent variables, potentially causing a spurious association."),
    ("Placebo-Controlled Trial", "placebo-controlled-trial", "A clinical trial comparing a new treatment to an inert placebo to isolate the treatment's effect."),
    ("Randomized Controlled Trial", "randomized-controlled-trial", "A study design that randomly assigns subjects to treatment or control, minimizing selection bias."),
    ("Double-Blind Study", "double-blind-study", "A study in which neither participants nor researchers know who received which intervention."),
    ("Meta-Analysis", "meta-analysis", "Statistical technique combining results from multiple studies to estimate a common effect."),
    ("Cohort Study", "cohort-study", "Longitudinal observational study following a group over time to observe outcomes."),
    ("Case-Control Study", "case-control-study", "Observational study comparing subjects with an outcome (cases) to those without (controls) to identify risk factors."),
    ("Cross-Sectional Study", "cross-sectional-study", "Observational study measuring outcomes and exposures at a single point in time."),
    ("Effect Size", "effect-size", "A quantitative measure of the magnitude of a phenomenon — Cohen's d, odds ratio, R²."),
    ("Cohen's d", "cohens-d", "A common effect size measure for the difference between two means, expressed in standard-deviation units."),
    ("Odds Ratio", "odds-ratio", "A measure of association between an exposure and an outcome — the odds in exposed divided by odds in unexposed."),
    ("Relative Risk", "relative-risk", "The ratio of the probability of an outcome in an exposed group to that in an unexposed group."),
    ("Sensitivity", "sensitivity-stats", "The proportion of true positives correctly identified by a diagnostic test."),
    ("Specificity", "specificity-stats", "The proportion of true negatives correctly identified by a diagnostic test."),
    ("ROC Curve", "roc-curve", "Receiver operating characteristic curve — plots true-positive vs false-positive rate across thresholds."),
    ("Data Visualization", "data-visualization", "The graphical representation of data to reveal patterns, trends, and outliers."),
    ("Histogram", "histogram", "Bar-chart representation of the distribution of a numerical variable."),
    ("Scatter Plot", "scatter-plot", "Graph plotting two variables against each other to reveal relationships."),
    ("Box Plot", "box-plot", "Standardized display of a distribution using quartiles and outliers."),
    ("Time Series", "time-series", "A sequence of data points indexed in time order."),
    ("Autocorrelation", "autocorrelation", "The correlation of a time series with a lagged version of itself."),
    ("Regression to the Mean", "regression-to-the-mean", "The phenomenon that extreme measurements tend to be closer to the average on subsequent measurement."),
    ("Simpson's Paradox", "simpsons-paradox", "A trend appearing in different groups of data disappears or reverses when the groups are combined."),
]
for name, slug, narr in STATS:
    kind = "measurement" if slug in ("z-score", "iqr", "range-stats", "percentile", "quartile", "arithmetic-mean", "median", "mode", "effect-size", "odds-ratio", "relative-risk", "sensitivity-stats", "specificity-stats", "cohens-d") else \
           "method" if slug in ("random-sampling", "stratified-sampling", "sampling-stats", "meta-analysis", "cohort-study", "case-control-study", "cross-sectional-study", "randomized-controlled-trial", "placebo-controlled-trial", "double-blind-study", "data-visualization", "histogram", "scatter-plot", "box-plot", "roc-curve") else \
           "phenomenon" if slug in ("regression-to-the-mean", "simpsons-paradox") else \
           "principle"
    SCIENCES.append(S(name, "statistics", kind,
                     id_slug=slug, extras=[name.lower()], narrative=narr,
                     applies=[":statistical"],
                     subsumed_by="statistics",
                     provenance=W(name.replace(" ", "_"))))

# ---- SUB-AREAS ----
for name, slug, narr in [
    ("Neuroscience", "neuroscience", "The scientific study of the nervous system — from molecules and cells to circuits and behavior."),
    ("Cognitive Science", "cognitive-science", "Interdisciplinary study of mind and its processes — draws on psychology, linguistics, neuroscience, AI, philosophy."),
    ("Psychology", "psychology", "The scientific study of mind and behavior."),
    ("Statistics", "statistics", "The discipline concerning the collection, organization, analysis, interpretation, and presentation of data."),
    ("Epidemiology", "epidemiology", "The study of the distribution and determinants of health and disease conditions in defined populations."),
]:
    SCIENCES.append(S(name, "statistics" if slug == "statistics" else ("neuroscience" if slug == "neuroscience" else ("cognitive-science" if slug == "cognitive-science" else "medicine")),
                     "classification",
                     id_slug=slug, narrative=narr,
                     subsumed_by="science",
                     provenance=W(name.replace(" ", "_"))))
