# Learning guide

Chiboshi is a place to explore estimates and explain choices. It is not a calibrated measuring instrument or an automated assessment of a child's ability.

## A short exploration cycle

1. **Predict.** Name an everyday object, a quantity, and a unit. Ask what the measurement would mean before viewing a comparison.
2. **Compare.** Use a sandbox or dictionary entry to examine the scale. Ask which part of the result supports or challenges the estimate.
3. **Revise.** Change the number or unit, one at a time, and explain the difference.
4. **Check.** Measure a real object or consult a reliable reference. Discuss why two objects of the same kind can have different dimensions.

The activity interface and reference content remain largely Chinese. Use units available in the chosen activity; the English examples below are discussion prompts, not a promise that every phrase is present in the dictionary.

## Activity ideas

| Dimension | Suggested prompt | What to discuss |
| --- | --- | --- |
| Length | Compare a pencil described as 18 cm with one described as 18 m. | A number without a suitable unit can describe a very different object. |
| Mass | Estimate a school bag in grams and kilograms. | Changing the unit should preserve the underlying quantity when the number is converted. |
| Capacity | Compare a drinking cup and a water bottle. | Capacity describes how much a container can hold; the actual container matters. |
| Area | Compare the surface of a desk with the classroom floor. | Area uses squared units and is different from a single side length. |
| Volume | Build a small cube from equal unit cubes. | Counting cubes connects three dimensions with cubic units. |
| Time | Estimate how long a familiar action takes, then time it. | Estimates vary; the measured activity provides a reference. |

### Example: changing a length unit

Start with `1 m = 100 cm`. Ask learners to keep the physical length the same while changing the unit. Then keep the number the same and change only the unit. These two operations produce different results. A visual comparison can help learners explain why.

### Example: separating area and volume

Compare covering a tabletop with equal squares and filling a box with equal cubes. Ask which unit belongs to each task. Use physical materials where possible; a screen illustration is only one representation.

## Using optional AI features

Ask an adult to configure the provider. Begin with fictional or generic descriptions, such as an unusually long pencil. Do not enter a learner's name, contact details, or other personal information.

Review generated descriptions and measurements before relying on them. Model output can be inconsistent or implausible, and displayed reference values should not be treated as universal properties of all real-world objects. Invite learners to question the result and check it independently.

## Exercises for developers

- Trace a dimension from its route into reference selection and rendering. Identify where the numeric value and unit enter the flow.
- Inspect a unit conversion. Check both directions and a boundary case; distinguish squared or cubed factors from length factors.
- Add a well-explained reference example. Record the source or estimation method and use an asset you have permission to distribute.
- Translate one complete interaction, including empty states, errors, and accessible labels. Keep display text separate from stable data identifiers.
- Examine a failed provider request. Describe what remains usable and how the interface communicates the failure.

See [Architecture](ARCHITECTURE.md) for starting points and [Contributing](../CONTRIBUTING.md) for review expectations.

## Record observations

A useful observation note contains the prompt, the learner's initial estimate, the explanation after comparison, and the physical or reference check. Keep such notes outside the repository and omit identifying learner information. These observations support discussion; they do not establish educational effectiveness without a suitable study.
